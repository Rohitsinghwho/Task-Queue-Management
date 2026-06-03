/**
 * Single source of truth for Redis keys used by the system.
 */

export interface QueueKeys{
    wait:string
    active:string
    completed:string
    failed:string
    dlq:string
}


export function buildKeys(queueName:string):QueueKeys{
    const prefix = `queue:${queueName}`
    return {
        wait: `${prefix}:wait`,
        active: `${prefix}:active`,
        completed: `${prefix}:completed`,
        failed: `${prefix}:failed`,
        dlq: `${prefix}:dlq`
    }
}



// Per-job keys to prevent collisions between jobs.

export function jobKey(queueName:string, jobId:string):string{
    return `bq:${queueName}:job:${jobId}`
}

export function lockkey(queueName:string, jobId:string):string{
    return `bq:${queueName}:lock:${jobId}`
}