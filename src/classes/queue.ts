/**
 * Queue client for enqueueing and inspecting jobs.
 *
 * Stores job payloads in Redis hashes and manages queue lists.
 */
import {generateRandomId} from '../utils/randomId.js';
import {createQueueClient,RedisClient} from '../redisClient/client.js';
import {buildKeys,QueueKeys,jobKey} from '../utils/keys.js';
import {jobStatus} from '../types/job.js'
import {Job, JobOptions} from '../interfaces/jobOptions.js';
import { eventBus } from './eventBus.js';
import { QueueEvents } from '../interfaces/QueueEvents.js';


export class Queue {
    private client : RedisClient
    private keys: QueueKeys
    private name: string
    private connected: boolean = false
    constructor(name:string,client:RedisClient){
        this.name = name
        this.client = client
        this.keys = buildKeys(name)
    }

    // Static method to create a queue instance with a new Redis client.
    // The constructor cannot be async, so we use a factory.
    static async create(name:string):Promise<Queue>{
        const client = await createQueueClient()
        const queue = new Queue(name,client)
        queue.connected = true
        console.log(`Queue ${name} created and connected to Redis`)
        return queue
    }

    // Main enqueue method used by producers.
    async add<T =Record<string,unknown>>(
    type:string,
    args:T,
    opts: JobOptions = {}
    ):Promise<Job<T>>{
        if(!this.connected){
            throw new Error('Queue is not connected to Redis')
            return null as unknown as Job<T>
        }
        const id = generateRandomId()
        const job:Job<T>={
            id,
            type,
            args,
            attempts:0,
            maxAttempts: opts.maxAttempts ??5,
            status:'pending',
            lockedUntil:null,
            failedReason:null,
            createdAt: new Date().toString()
        }

        // Two Redis operations:
        // 1) store job data in a hash so the worker can fetch by id
        // 2) push job id to the wait list so a worker can pick it up
        // Not atomic yet; a Lua script can wrap this later.
        await this.client.hSet(
            jobKey(this.name,job.id),
            this.serializeJob(job)
        )

        await this.client.lPush(this.keys.wait, job.id);

        eventBus.emit('queue',{type:'job.added', job} as QueueEvents)
        console.log(`[Queue:${this.name}] added job ${job.id} type=${type}`)
        return job
    }


    // Look up a job by id.

    async getJob<T = Record<string,unknown>>(id:string):Promise<Job<T> | null>{
        const data = await this.client.hGetAll(jobKey(this.name,id))
        if(!data||Object.keys(data).length === 0){
            return null
        }
        return this.deserializeJob(data) as Job<T>
    }


    // How many jobs are waiting in the queue.
    async getWaitingCount():Promise<number>{
        return await this.client.lLen(this.keys.wait)
    }

    // Get status of the queue: counts per list.
    async getStatus():Promise<Record<jobStatus | 'waiting',number>>{
        const [waiting,active,completed,failed]= await Promise.all([
            this.client.lLen(this.keys.wait),
            this.client.lLen(this.keys.active),
            this.client.lLen(this.keys.completed),
            this.client.lLen(this.keys.failed)
        ]);
        return { waiting, active, completed, failed , pending:0, retrying:0}
    }


    // Clean shutdown of the queue and Redis client.
    async close():Promise<void>{
        await this.client.quit()
        this.connected = false
        console.log(`Queue ${this.name} closed and disconnected from Redis`)
    }


    // Alias for wait list length.
    async getLength():Promise<number>{
        return await this.client.lLen(this.keys.wait)
    }

    // Serialize/deserialize job data for storage in Redis hashes.
    private serializeJob<T>(job:Job<T>):Record<string,string>{
        return {
            id: job.id,
            type: job.type,
            args: JSON.stringify(job.args),
            attempts: job.attempts.toString(),
            maxAttempts: job.maxAttempts.toString(),
            status: job.status,
            createdAt: job.createdAt,
            lockedUntil: job.lockedUntil ? job.lockedUntil.toString() : '',
            failedReason: job.failedReason ?? ''
        }
    }


    private deserializeJob<T>(data:Record<string,string>):Job<T>{
        return {
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

    

}