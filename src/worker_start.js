
// worker_start.js — run this in a separate terminal
//
// Terminal 1: node worker_start.js
// Terminal 2: node producer.js
//
// Watch Terminal 1 pick up jobs that Terminal 2 enqueues.
// The worker keeps running and waiting even when queue is empty.

import { startWorker } from "./worker.js";

startWorker();