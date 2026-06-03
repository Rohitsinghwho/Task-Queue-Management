/**
 * Worker process entry point.
 *
 * Starts worker loops and handles graceful shutdown.
 */
import { Worker } from './classes/worker.js'

async function main() {
  const worker = await Worker.create('myqueue', { concurrency: 3 })

  process.on('SIGINT', async () => {
    await worker.stop()
    process.exit(0)
  })

  await worker.start()
}

main()