// janitor.js - This module defines the Janitor class, responsible for cleaning up expired tasks from the Redis database.

import { createJanitorClient, RedisClient } from "../redisClient/client.js";
import { buildKeys, QueueKeys, jobKey, lockkey } from "../utils/keys.js";
import { JanitorOptions } from "../interfaces/janitorOptions.js";

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

  // static method to create a janitor instance with a new Redis client
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

  // start() - method to start the janitor process, which will run at regular intervals to clean up expired tasks
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

  //   stop() - method to stop the janitor process
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

  // scan() -main logic runs on every interval
  private async scan(): Promise<void> {
    console.log(`[Janitor:${this.name}] scanning active queue...`);
    try {
      // get all the job ids from the active queue
      // this are the jobs which are picked up by the worker
      // but not completed yet, so we need to check if they are expired or not
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

  // checkJob() - check if a job is expired or not, if expired move it back to the wait queue for retry
  private async checkJob(jobId: string): Promise<void> {
    const lock = await this.client.get(lockkey(this.name, jobId));

    if (lock) {
      // lock exixts , workers are still processing the job, so skip it
      // lock has a ttl so it will expire naturally
      console.log(`[Janitor:${this.name}] job ${jobId} is locked, skipping...`);
      return;
    }

    // lock is gone but job is still in active queue
    // this means the worker has died or got stuck while processing the job

    console.log(
      `[Janitor:${this.name}] job ${jobId} lock expired,recovering...`,
    );
    await this.recover(jobId);
  }

  // recover() - move the stuck job back to the wait queue for retry

  private async recover(jobId: string): Promise<void> {
    // fetch the job
    const data = await this.client.hGetAll(jobKey(this.name, jobId));
    if (!data || Object.keys(data).length === 0) {
      // job data is missing, this should not happen but we can just skip it
      console.warn(
        `[Janitor:${this.name}] job ${jobId} data is missing, skipping recovery...`,
      );
      // remove the job from active queue
      await this.client.lRem(this.keys.active, 0, jobId);
      return;
    }

    const attempts = parseInt(data.attempts ?? "0");
    const maxAttempts = parseInt(data.maxAttempts ?? "5");

    // check if the job has exceeded max attempts
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

    //  not atomic yet — recoverJob.lua will fix this in Phase 2
    // for now: LMOVE is at least atomic for the list operation
    // if crash happens between lMove and hSet — job is back in wait
    // which is safe (better than losing it)
    await this.client.lMove(this.keys.active, this.keys.wait, "LEFT", "RIGHT");
    console.log(
      `[Janitor:${this.name}] job ${jobId} moved back to wait queue for retry (attempt ${attempts + 1}/${maxAttempts})`,
    );
  }

//   moveToFailed() - move the job to failed queue when it has exceeded max attempts
    private async moveToFailed(jobId: string, reason: string): Promise<void> {
        // NOT ATOMIC YET
        await this.client.lRem(this.keys.active, 0, jobId);
        await this.client.lPush(this.keys.failed, jobId);
        await this.client.hSet(jobKey(this.name, jobId), {
            status: 'failed',
            failedReason: reason
        })
        console.log(`[Janitor:${this.name}] job ${jobId} moved to failed queue`)
    }
}
