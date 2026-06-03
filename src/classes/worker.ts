// 1. Connect to Redis (separate client from Queue)
// 2. Poll for jobs (BLMOVE — blocking)
// 3. Handle concurrency (N jobs at once)
// 4. Execute the job (call task handler)
// 5. On success → update job hash + move to completed
// 6. On failure → NACK (retry with backoff or move to DLQ)
// 7. Janitor hook → update lock on each job
// 8. Clean shutdown (finish in-flight jobs before stopping)

import { createWorkerClient, RedisClient } from "../redisClient/client.js";
import { calculateBackoff } from "../utils/backoff.js";
import { buildKeys, QueueKeys, jobKey, lockkey } from "../utils/keys.js";
import { Job, JobOptions } from "../interfaces/jobOptions.js";
import { jobStatus } from "../types/job.js";
import { taskRegistry } from "../task.js";
import { WorkerOptions } from "../interfaces/workerOptions.js";

export class Worker {
  private client: RedisClient;
  private queueName: string;
  private keys: QueueKeys;
  private isConnected: boolean = false;
  private running: boolean = false;
  private activeJobs: Set<string> = new Set(); //track active job ids
  private options: Required<WorkerOptions>;

  constructor(
    queueName: string,
    client: RedisClient,
    options: WorkerOptions = {},
  ) {
    this.queueName = queueName;
    this.client = client;
    this.keys = buildKeys(queueName);
    this.options = {
      concurrency: options.concurrency || 1,
      visibilityTimeout: options.visibilityTimeout || 60,
      pollTimeout: options.pollTimeout || 5,
    };
  }

  // static factory method to create worker because constructor can't be async
  static async create(
    queueName: string,
    options: WorkerOptions = {},
  ): Promise<Worker> {
    const client = await createWorkerClient();
    const worker = new Worker(queueName, client, options);
    worker.isConnected = true;
    console.log(`Worker for queue ${queueName} created and connected to Redis`);
    return worker;
  }

  // start point for worker to start processing jobs
  // spawns N concurrent loops to poll for jobs
  async start(): Promise<void> {
    this.running = true;
    console.log(
      `[Worker:${this.queueName}] starting ` +
        `concurrency=${this.options.concurrency}`,
    );

    // spawn N concurrent loops to poll for jobs
    const loops = Array.from({ length: this.options.concurrency }, (_i) =>
      this.runLoop(),
    );
    await Promise.all(loops);
  }

  //   graceful shutdown:
  // stops accepting new jobs, waits for in-flight jobs to finish

  async stop(): Promise<void> {
    console.log(`[Worker:${this.queueName}] stopping gracefully...`);
    this.running = false;

    // wait for active jobs to finish
    while (this.activeJobs.size > 0) {
      console.log(
        `[Worker:${this.queueName}] waiting for ${this.activeJobs.size} active jobs to finish...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await this.client.quit();
    console.log(
      `[Worker:${this.queueName}] stopped and disconnected from Redis`,
    );
  }

  //   run loop is the main worker loop that polls for jobs and processes them

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        // BLMOVE automically moves job Id from wait to active and returns the job id
        // blocks for pollTimeout seconds if no job is available

        const jobId = await this.client.blMove(
          this.keys.wait,
          this.keys.active,
          "LEFT",
          "RIGHT",
          this.options.pollTimeout,
        );

        // timeout - no jobs available
        if (!jobId) {
          continue;
        }

        // set lock so that janitor can detect that this job is being processed and not stuck
        await this.setLock(jobId);

        // track this job as in flight
        this.activeJobs.add(jobId);

        // process and handle result
        await this.processJob(jobId);

        this.activeJobs.delete(jobId);
      } catch (err) {
        console.error(`[Worker:${this.queueName}] error in run loop:`, err);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  //   processJob() - fetch the job data, execute the task handler, and update job status based on result
  private async processJob(jobId: string): Promise<void> {
    // fetch job from hash
    const job = await this.getJob(jobId);
    if (!job) {
      // jobId was in list but no corresponding hash data - this shouldn't happen but we can just skip it
      // corrupted State - remove from active and move on
      console.error(
        `[Worker:${this.queueName}] job ${jobId} not found in hash, discarding...`,
      );
      await this.client.lRem(this.keys.active, 1, jobId);
      return;
    }

    // update status to Active in hash
    await this.updateJobStatus(jobId, "active");
    console.log(
      `[Worker:${this.queueName}] ` +
        `processing job ${jobId} type=${job.type} ` +
        `attempt=${job.attempts + 1}/${job.maxAttempts}`,
    );

    // find the handler
    const handler = taskRegistry[job.type];
    if (!handler) {
      console.error(
        `[Worker:${this.queueName}] no handler found for job type ${job.type}, moving to failed...`,
      );
      await this.moveToFailed(
        job,
        `No handler found for job type: ${job.type}`,
      );
      return;
    }

    try {
      // execute the handler
      await handler(job.args);
      await this.moveToCompleted(job);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[Worker] job ${jobId} failed:`, reason);
      await this.NACK(job, reason);
    }
  }

  //   moveToCompleted()
  private async moveToCompleted(job: Job): Promise<void> {
    // not atomic yet - moveToCompleted lua will fix it later
    await this.client.lRem(this.keys.active, 1, job.id);
    await this.client.lPush(this.keys.completed, job.id);
    await this.updateJobStatus(job.id, "completed");
    await this.releaseLock(job.id);

    console.log(
      `[Worker:${this.queueName}] job ${job.id} completed successfully`,
    );
  }

  //   moveToFailed()
  private async moveToFailed(job: Job, reason: string): Promise<void> {
    // not atomic yet - moveToFailed lua will fix it later
    await this.client.lRem(this.keys.active, 1, job.id);
    await this.client.lPush(this.keys.failed, job.id);
    await this.client.hSet(
      jobKey(this.queueName, job.id),
      "failedReason",
      reason,
    );
    await this.releaseLock(job.id);
    console.log(`[Worker:${this.queueName}] job ${job.id} failed: ${reason}`);
  }
  // NACK() - retry with backoff or move to DLQ

  private async NACK(job: Job, reason: string): Promise<void> {
    await this.client.lRem(this.keys.active, 1, job.id);
    await this.releaseLock(job.id);

    job.attempts += 1;

    if (job.attempts >= job.maxAttempts) {
      console.log(
        `[Worker:${this.queueName}] job ${job.id} reached max attempts, moving to failed...`,
      );
      await this.moveToFailed(job, reason + " | reached max attempts");
      return;
    }

    await this.client.hSet(jobKey(this.queueName, job.id), {
      attempts: job.attempts.toString(),
      status: "retrying",
    });
    const delay = calculateBackoff(job.attempts);
    console.log(
      `[Worker:${this.queueName}] retrying job ${job.id} in ${Math.round(delay / 1000)}s... (reason: ${reason})`,
    );

    // push back to wait queue after delay
    setTimeout(async () => {
      await this.client.lPush(this.keys.wait, job.id);
    }, delay);
  }

  //   lock helpers

//   set lock when job is being processed, so that janitor can detect stuck jobs by looking for locks that have expired (older than visibility timeout)
  private async setLock(jobId: string): Promise<void> {
    await this.client.set(
      lockkey(this.queueName, jobId),
      Date.now().toString(),
      {
        EX: this.options.visibilityTimeout,
      },
    );
  }

//   release lock after job is done (either completed or failed)
    private async releaseLock(jobId: string): Promise<void> {
        await this.client.del(lockkey(this.queueName, jobId))
    }


    // redis hash helpers to serialize/deserialize job data

    private async getJob(jobId:string):Promise<Job | null>{
        const data=await this.client.hGetAll(jobKey(this.queueName,jobId))
        if(!data||Object.keys(data).length === 0){
            return null
        }

        return{
            id: data.id,
            type: data.type,
            args: JSON.parse(data.args),
            attempts: parseInt(data.attempts),
            maxAttempts: parseInt(data.maxAttempts),
            status: data.status as jobStatus,
            createdAt: data.createdAt,
            lockedUntil: data.lockedUntil ? parseInt(data.lockedUntil) : null,
            failedReason: data.failedReason || null
        }
    }

    // update job status 
    private async updateJobStatus(jobId:string, status:jobStatus):Promise<void>{
        await this.client.hSet(jobKey(this.queueName, jobId), { status })
    }



}
