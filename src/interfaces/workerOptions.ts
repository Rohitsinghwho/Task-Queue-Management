/**
 * Worker runtime options.
 */
export interface WorkerOptions {
  concurrency?: number        // how many jobs to process at once, default 1
  visibilityTimeout?: number  // seconds before job considered stuck, default 60
  pollTimeout?: number        // seconds to wait for job, default 5
}