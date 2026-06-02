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

export function processJobs(rawJob) {
  console.log("Worker started, waiting for jobs...");

  // process the jobs
  const job = JSON.parse(rawJob);
  console.log(`Processing job ${job.id} of type ${job.type}`);
  const taskFunction = taskRegistry[job.type];
  if (!taskFunction) {
    console.log(`No task function registered for job type ${job.type}`);
    return;
  }

  try {
    // await taskFunction(job.args); - if the task function is async, we can await it to ensure proper error handling and logging
    taskFunction(job.args);
    console.log(`Job ${job.id} completed successfully`);
    // -------------------------------------------------------
    //    NOTICE: we do NOTHING after success.
    //    The job was already removed from Redis by BRPOP
    //    the moment we picked it up.
    //
    //    This means: if we crash here after BRPOP but
    //    before finishing — the job is GONE FOREVER.
    //
    //    This is the exact problem Phase 3 fixes with leasing.
    // -------------------------------------------------------
  } catch (err) {
    console.log(`Error processing job ${job.id}:`, err);
    // Phase 2 has no retry — job is just lost on failure too
    // Phase 3 fixes this
  }
}

export async function startWorker() {
  const workerClient = await CreateWorkerClient();
  if (!workerClient) {
    console.log("Failed to create Redis client for worker. Exiting.");
    return;
  }
  console.log("Worker connected to Redis, waiting for jobs...");
  console.log(`listening on key ${QUEUE_NAME}`);

  while (true) {
    try {
      // BRPOP blocks until a job is available in the queue
      const result = await workerClient.brPop(QUEUE_NAME, 1); // 0 means block indefinitely
      if (!result) continue;

      const { element: rawJob } = result; // result is an array [keyName, value]
      console.log(`Received job from queue ${QUEUE_NAME}: ${rawJob}`);
      processJobs(rawJob);
    } catch (err) {
      console.log("Error in worker loop:", err);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for 5 seconds before retrying to avoid tight error loop
    }
  }
}
