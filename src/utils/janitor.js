// janitor.js - a simple script to clean up the processing queue in case of worker crashes
// Run this script if you notice jobs stuck in the processing queue due to worker crashes.
// It will move all jobs from the processing queue back to the main queue for retry.
import dotenv from "dotenv";
dotenv.config();
import { createClient } from "redis";
import { QUEUE_NAME } from "../queue.js";
import { PROCESSING_QUEUE_NAME } from "../worker.js";

async function createJanitorClient() {
  const janitorClient = createClient({
    url: process.env.REDIS_URL,
  });
  janitorClient.on("error", (err) =>
    console.log("Janitor Redis Client Error", err),
  );
  await janitorClient.connect();
  return janitorClient;
}

const janitorClient = await createJanitorClient();
async function cleanUpProcessingQueue() {
  if (!janitorClient) {
    console.log("Failed to create Redis client for janitor. Exiting.");
    return;
  }
  console.log(
    `Janitor connected to Redis. Cleaning up processing queue: ${PROCESSING_QUEUE_NAME}`,
  );
  const len = await janitorClient.lLen(PROCESSING_QUEUE_NAME);
  if (len === 0) {
    console.log(
      `Processing queue ${PROCESSING_QUEUE_NAME} is already empty. No cleanup needed.`,
    );
    return;
  }

  while (true) {
    try {
      const items = await janitorClient.lRange(PROCESSING_QUEUE_NAME, 0, -1);
      if (items.length === 0) {
        console.log(
          `Processing queue ${PROCESSING_QUEUE_NAME} is now empty. Cleanup complete.`,
        );
        break;
      }

      for (const item of items) {
        const jobData = JSON.parse(item);
        const lock = await janitorClient.get(`lock:${jobData.id}`);
        if (lock) {
          console.log(`Job ${jobData.id} is currently locked. Skipping.`);
          continue; //worker is still processing this job, skip it
        }
        console.log(`Job ${jobData.id} lock expired — requeueing`);
        await janitorClient.lRem(PROCESSING_QUEUE_NAME, 1, item);
        await janitorClient.lPush(QUEUE_NAME, item);
      }
    } catch (err) {
      console.log("Error in janitor loop:", err);
    }
    break;
  }
}

setInterval(cleanUpProcessingQueue, 10000); // ✅ run every 10 seconds
console.log("Janitor started — checking every 10 seconds");