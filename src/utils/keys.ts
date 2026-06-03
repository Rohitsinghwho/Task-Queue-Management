// Single Source of Truth for Redis key in the entire application

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



// for per job keys because each job will have a unique key for preventing collision between jobs

export function jobKey(queueName:string, jobId:string):string{
    return `bq:${queueName}:job:${jobId}`
}

export function lockkey(queueName:string, jobId:string):string{
    return `bq:${queueName}:lock:${jobId}`
}