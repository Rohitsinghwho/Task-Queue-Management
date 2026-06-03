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

  // keep process alive — janitor.start() is non blocking
  await new Promise(() => {})
}

main()