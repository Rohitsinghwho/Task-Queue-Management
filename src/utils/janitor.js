// janitor.js - a simple script to clean up the processing queue in case of worker crashes
// Run this script if you notice jobs stuck in the processing queue due to worker crashes.
// It will move all jobs from the processing queue back to the main queue for retry.
import dotenv from "dotenv";
dotenv.config();
import { createClient } from "redis";
import { QUEUE_NAME } from "../queue.js";
import {PROCESSING_QUEUE_NAME} from "../worker.js";


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

async function cleanUpProcessingQueue() {

    const janitorClient = await createJanitorClient();
    if (!janitorClient) {
        console.log("Failed to create Redis client for janitor. Exiting.");
        return;
    }
    console.log(`Janitor connected to Redis. Cleaning up processing queue: ${PROCESSING_QUEUE_NAME}`);
    const len=await janitorClient.lLen(PROCESSING_QUEUE_NAME);
    if(len===0){
        console.log(`Processing queue ${PROCESSING_QUEUE_NAME} is already empty. No cleanup needed.`);
        await janitorClient.quit();
        return;
    }

    while(true){
        try{
            const job= await janitorClient.lMove(PROCESSING_QUEUE_NAME, QUEUE_NAME, 'RIGHT','LEFT', 1); // timeout of 0 means block indefinitely until a job is available
            if(!job){
                console.log(`No more jobs to move back to main queue.`);
                break;
            }
            const jobData= JSON.parse(job);
            console.log(`Moved job ${jobData.id} of type ${jobData.type} back to main queue for retry.`);

        }catch(err){
            console.log("Error in janitor loop:", err);
        }
    }
}


cleanUpProcessingQueue();