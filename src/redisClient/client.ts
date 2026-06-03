import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

function createRedisClient(name: string){ 
    const client = createClient({
        // Use the Redis URL from environment variables for better security and flexibility 
        // using upstash for hosting our Redis instance, which provides a secure and scalable solution for our task queue management system
        url: process.env.REDIS_URL
    });
    client.on('error', (err) => console.error(`[${name}] Redis error:`, err))
    return client;
}

export async function createQueueClient(){
    const client = createRedisClient('Queue');
    await client.connect();
    return client;
}

export async function createWorkerClient(){
    const client = createRedisClient('Worker');
    await client.connect();
    return client;
}

export async function createJanitorClient(){
    const client = createRedisClient('Janitor');
    await client.connect();
    return client;
}


export type RedisClient = Awaited<ReturnType<typeof createRedisClient>>;