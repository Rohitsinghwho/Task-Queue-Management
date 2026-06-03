/**
 * Janitor class responsible for recovering stuck jobs.
 *
 * It scans the active list for jobs whose locks have expired and either retries
 * them or moves them to failed based on attempts.
 */

import { createJanitorClient, RedisClient } from "../redisClient/client.js";
import { buildKeys, QueueKeys, jobKey, lockkey } from "../utils/keys.js";
import { JanitorOptions } from "../interfaces/janitorOptions.js";
import { QueueEvents } from "../interfaces/QueueEvents.js";
import { eventBus } from "./eventBus.js";

export class Janitor {
  private client: RedisClient;
  private keys: QueueKeys;
  private name: string;
  private options: Required<JanitorOptions>;
  private running: boolean = false;
  private isConnected: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  constructor(
    queueName: string,
    client: RedisClient,
    options: JanitorOptions = {},
  ) {
    this.name = queueName;
    this.client = client;
    this.keys = buildKeys(queueName);
    this.options = {
      pollInterval: options.pollInterval ?? 10000,
      visibilityTimeout: options.visibilityTimeout ?? 60,
    };
  }

  // Static factory method because constructor cannot be async.
  static async create(
    queueName: string,
    options: JanitorOptions = {},
  ): Promise<Janitor> {
    const client = await createJanitorClient();
    const janitor = new Janitor(queueName, client, options);
    janitor.isConnected = true;
    console.log(
      `Janitor for queue ${queueName} created and connected to Redis`,
    );
    return janitor;
  }

  // Start the janitor loop that periodically scans for stuck jobs.
  start(): void {
    if (!this.isConnected) {
      throw new Error("Janitor is not connected to Redis");
    }
    if (this.running) {
      console.warn("Janitor is already running");
      return;
    }
    this.running = true;
    console.log(
      `Janitor for queue ${this.name} started with poll interval ${this.options.pollInterval} ms and visibility timeout ${this.options.visibilityTimeout} seconds`,
    );

    this.scan();
    this.intervalId = setInterval(() => this.scan(), this.options.pollInterval);
  }

  // Stop the janitor loop and close the Redis client.
  async stop(): Promise<void> {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.client.quit();
    console.log(
      `Janitor for queue ${this.name} stopped and disconnected from Redis`,
    );
  }

  // Main logic that runs on every interval.
  private async scan(): Promise<void> {
    console.log(`[Janitor:${this.name}] scanning active queue...`);
    try {
      // Get job IDs currently in the active list (picked by workers, not completed).
      // Each is checked for an expired lock to detect stuck processing.
      const activeJobIds = await this.client.lRange(this.keys.active, 0, -1);
      if (activeJobIds.length === 0) {
        console.log(`[Janitor:${this.name}] no active jobs found`);
        return;
      }
      console.log(
        `[Janitor:${this.name}] found ${activeJobIds.length} active jobs, checking for expired jobs...`,
      );
      for (const jobId of activeJobIds) {
        await this.checkJob(jobId);
      }
    } catch (err) {
      console.error(`[Janitor:${this.name}] error scanning active queue`, err);
    }
  }

  // Check if a job is expired; if so, recover it back to wait for retry.
  private async checkJob(jobId: string): Promise<void> {
    const lock = await this.client.get(lockkey(this.name, jobId));

    if (lock) {
      // Lock exists: workers are still processing, so skip it.
      // Lock has a TTL and will expire naturally.
      console.log(`[Janitor:${this.name}] job ${jobId} is locked, skipping...`);
      return;
    }

    // Lock is gone but job is still in active queue: worker likely died or hung.

    console.log(
      `[Janitor:${this.name}] job ${jobId} lock expired,recovering...`,
    );
    await this.recover(jobId);
  }

  // Move a stuck job back to the wait queue for retry.

  private async recover(jobId: string): Promise<void> {
    // fetch the job
    const data = await this.client.hGetAll(jobKey(this.name, jobId));
    if (!data || Object.keys(data).length === 0) {
      // Job data is missing; remove the dangling ID from active to avoid leaks.
      console.warn(
        `[Janitor:${this.name}] job ${jobId} data is missing, skipping recovery...`,
      );
      // Remove the job from active queue.
      await this.client.lRem(this.keys.active, 0, jobId);
      eventBus.emit('queue',{type:'queue.recovered', jobId} as QueueEvents)
      return;
    }

    const attempts = parseInt(data.attempts ?? "0");
    const maxAttempts = parseInt(data.maxAttempts ?? "5");

    // Check if the job has exceeded max attempts.
    if (attempts >= maxAttempts) {
      console.warn(
        `[Janitor:${this.name}] job ${jobId} has exceeded max attempts, moving to failed queue...`,
      );
      // move the job to failed queue
      await this.moveToFailed(jobId, "exceeded max attempts");
      return;
    }
    await this.client.hSet(jobKey(this.name, jobId), {
      attempts: (attempts + 1).toString(),
      status: "retrying",
    });

    // Not fully atomic yet — recoverJob.lua will fix this in Phase 2.
    // For now: LMOVE is atomic for list movement. If a crash happens between
    // lMove and hSet, the job is back in wait, which is safer than losing it.
    await this.client.lMove(this.keys.active, this.keys.wait, "LEFT", "RIGHT");
    console.log(
      `[Janitor:${this.name}] job ${jobId} moved back to wait queue for retry (attempt ${attempts + 1}/${maxAttempts})`,
    );
  }

// Move job to failed queue when it has exceeded max attempts.
    private async moveToFailed(jobId: string, reason: string): Promise<void> {
    // Not atomic yet — failure flow will be wrapped in Lua in a later phase.
        await this.client.lRem(this.keys.active, 0, jobId);
        await this.client.lPush(this.keys.failed, jobId);
        await this.client.hSet(jobKey(this.name, jobId), {
            status: 'failed',
            failedReason: reason
        })
        console.log(`[Janitor:${this.name}] job ${jobId} moved to failed queue`)
    }
}
