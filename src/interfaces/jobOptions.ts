import { jobStatus } from "../types/job.js";
/**
 * Job payload stored in Redis.
 */
export interface Job <T = Record<string,unknown>>{
    id: string
    type:string
    args:T
    attempts: number
    maxAttempts:number
    status: jobStatus
    lockedUntil: number | null
    failedReason: string | null
    createdAt: string
}

/**
 * Options for enqueueing a job.
 */
export interface JobOptions {
    maxAttempts?: number
}
