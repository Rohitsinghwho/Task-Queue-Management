import {Job} from './jobOptions.js';
/**
 * Events emitted by the queue/worker/janitor for observers (e.g., SSE).
 */
export type QueueEvents=
    | {type:'job.added'; job:Job}
    | {type:'job.active'; job:Job}
    | {type:'job.completed'; job:Job}
    | {type:'job.failed'; job:Job; reason:string}
    | {type:'job.retrying'; job:Job; reason:string}
    | {type:'job.locked'; job:Job}
    | {type:'job.unlocked'; job:Job}
    | {type:'queue.recovered'; jobId:string};

