// queue.js - enqueue writes to redis List

// Phase 1 : queue.push(job)  - in memory array
// Phase 2 : LPUSH jobs <job>  - using Redis List for persistence and reliability

// Redis List as a queue:
// LPUSH jobs <job>  - add job to the left of the list (enqueue)
// BRPOP jobs          - remove and return the rightmost job (dequeue)  - in worker.js


import client from './redisClient/client.js'
import { v4 as uuidv4 } from 'uuid';

export const QUEUE_NAME = 'jobs';

export async function Enqueue(taskType, args) {
    // serialize the job as a JSON string
    const job={
        id: uuidv4(), // unique identifier for the job
        type: taskType,
        args: args,
        attempts: 0, // for retry logic
        maxAttempts: 5, // max retry attempts before giving up
        lockeduntil: null, // for future use in delayed jobs
        status:'pending',
        createdAt: Date.now().toString(),
     };
     
    const serializedJob= JSON.stringify(job);
    //  push the job to the Redis List
    await client.lPush(QUEUE_NAME,serializedJob);
    const queueLength= await client.lLen(QUEUE_NAME);
    console.log(`Enqueued job ${job.id} of type ${taskType}. Queue length is now ${queueLength}`);
    return job.id;
}


export async function GetQueueLength() {
    const queueLength= await client.lLen(QUEUE_NAME);
    return queueLength;
}

