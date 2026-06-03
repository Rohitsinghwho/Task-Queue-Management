/**
 * Exponential backoff with jitter for retries.
 */
export function calculateBackoff(attempts:number,baseDelay:number =1000):number{
    const base=Math.pow(2,attempts)*baseDelay
    const jitter = Math.random() * baseDelay
    return base + jitter
}


