// worker.js - the worker process that pulls tasks from the queue and executes them
// Phase 1: worker pulls task from array using dequeue()
// Phase 2: worker pulls task from Redis List using BRPOP and executes it

// BRPOP - Blocks the connection until a job is available in the list, ensuring efficient resource usage
// syntax - BROP <key> <timeout>
// Example - BRPOP jobs 0  - blocks indefinitely until a job is available in the "jobs" list
// returns : [keyName,value] when a job arrives, where keyName is the name of the list and value is the job data

import { QUEUE_NAME } from "./queue.js";
import { taskRegistry } from "./task.js";
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

export const PROCESSING_QUEUE_NAME = `${QUEUE_NAME}:processing`; // unique processing queue for this worker instance
export const VISIBILITY_TIMEOUT = 60; // seconds - time after which a job is considered "stuck" in processing and can be retried by janitor

async function CreateWorkerClient() {
  const workerClient = createClient({
    url: process.env.REDIS_URL,
  });
  workerClient.on("error", (err) =>
    console.log("Worker Redis Client Error", err),
  );
  await workerClient.connect();
  return workerClient;
}

export async function processJobs(rawJob, workerClient) {
  console.log("Worker started, waiting for jobs...");

  // process the jobs
  const job = JSON.parse(rawJob);
  console.log(`Processing job ${job.id} of type ${job.type}`);
  const taskFunction = taskRegistry[job.type];
  if (!taskFunction) {
    console.log(`No task function registered for job type ${job.type}`);
    // remove unrecognized job from processing queue to prevent it from blocking the worker
    await workerClient.lRem(PROCESSING_QUEUE_NAME, 1, rawJob);
    return;
  }

  try {
    // await taskFunction(job.args); - if the task function is async, we can await it to ensure proper error handling and logging
    await taskFunction(job.args);
    console.log(`Job ${job.id} completed successfully`);
    //  PHASE 3 FIX - if the job fails then it will be put back to the main queue for retry
    // remove the job from the processing queue after successful execution
    await workerClient.lRem(PROCESSING_QUEUE_NAME, 1, rawJob);
    await workerClient.del(`lock:${job.id}`); // release the lock after processing
  } catch (err) {   
    console.log(`Error processing job ${job.id}:`, err);
    await NACK(rawJob, workerClient); // move the job back to the main queue for retry
  }
}

async function NACK(rawJob, workerClient) {
  const job = JSON.parse(rawJob);
  await workerClient.lRem(PROCESSING_QUEUE_NAME, 1, rawJob); // remove the job from processing queue
  await workerClient.del(`lock:${job.id}`); // release the lock so that janitor can retry it if needed
  job.attempts += 1;

  if (job.attempts > job.maxAttempts) {
    console.log(
      `Job ${job.id} has exceeded max retry attempts. Marking as failed.`,
    );
    return;
    // jobs will be moved to DLQ after max retry attempts. For now we just log it and drop the job to prevent it from blocking the worker.
  }

  const expoBackoffTime=(Math.pow(2,job.attempts)+Math.random())*1000; // exponential backoff with jitter
  console.log(`Retrying job ${job.id} in ${expoBackoffTime.toFixed(0)} ms (attempt ${job.attempts}/${job.maxAttempts})`);
  setTimeout(async () => {
    await workerClient.lPush(QUEUE_NAME, JSON.stringify(job)); // push the job back to the main queue for retry
    
  }, expoBackoffTime);
}

export async function startWorker() {
  const workerClient = await CreateWorkerClient();
  if (!workerClient) {
    console.log("Failed to create Redis client for worker. Exiting.");
    return;
  }
  console.log("Worker connected to Redis, waiting for jobs...");
  console.log(
    `Listening on main key: ${QUEUE_NAME} | Tracking in: ${PROCESSING_QUEUE_NAME}`,
  );
  while (true) {
    try {
      // -------------------------------------------------------
      // PHASE 3 IMPLEMENTATION: Replaced destructive BRPOP
      // -------------------------------------------------------
      // blMove atomically pops from Main Queue and pushes to Processing Queue.
      // If the worker crashes immediately after this line, the task remains safely in Redis!
      const result = await workerClient.blMove(
        QUEUE_NAME,
        PROCESSING_QUEUE_NAME,
        "RIGHT",
        "LEFT",
        1,
      ); // timeout of 0 means block indefinitely until a job is available
      if (!result) continue;

      // set a lock for the job to prevent multiple workers from processing the same job
      // instead of using
      const job = JSON.parse(result);
      await workerClient.set(
        `lock:${job.id}`,
        Date.now() + VISIBILITY_TIMEOUT * 1000, // set lock expiration time
        { EX: VISIBILITY_TIMEOUT },
      );

      console.log(`Received job safely via blMove: ${result}`);
      await processJobs(result, workerClient);
    } catch (err) {
      console.log("Error in worker loop:", err);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for 5 seconds before retrying to avoid tight error loop
    }
  }
}
