/**
 * Janitor process entry point.
 *
 * Starts the janitor loop for a queue and keeps the process alive until SIGINT.
 */
import { Janitor } from './classes/janitor.js'

async function main() {
  const janitor = await Janitor.create('myqueue', {
    pollInterval: 10000
  })

  process.on('SIGINT', async () => {
    await janitor.stop()
    process.exit(0)
  })

  janitor.start()

  // Keep process alive — janitor.start() is non-blocking and the loop lives on timers.
  await new Promise(() => {})
}

main()