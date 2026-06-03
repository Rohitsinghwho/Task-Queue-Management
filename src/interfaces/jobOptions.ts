import { jobStatus } from "../types/job.js";
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

export interface JobOptions {
    maxAttempts?: number
}
