import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();
const client = createClient({
    // Use the Redis URL from environment variables for better security and flexibility 
    // using upstash for hosting our Redis instance, which provides a secure and scalable solution for our task queue management system
    url: process.env.REDIS_URL
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

export default client;