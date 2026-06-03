import { Queue } from './classes/queue.js'

async function main() {
  const queue = await Queue.create('myqueue')

  await queue.add('send_email', { to: 'user@example.com', subject: 'Hello' })
  await queue.add('resize_image', { path: '/img.jpg', width: 800, height: 600 })
  await queue.add('generate_report', { userId: 123, reportType: 'sales' })

  console.log(`Queue length: ${await queue.getLength()}`)
  await queue.close()
}

main()