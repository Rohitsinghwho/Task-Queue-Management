// main.js the main entry point of the application where we enqueue tasks and start the worker
import { Enqueue } from './queue.js';
import { startWorker } from './worker.js';


// Enqueue some tasks
Enqueue('send_email', {subject: 'Hello World', to: 'rohitsingh16@gmail.com'})
Enqueue('resize_image', {imagePath: '/path/to/image.jpg', width: 800, height: 600})
Enqueue('generate_report', {userId: 123, reportType: 'sales'})


const Delay=20000; // 10 seconds

// Enqueue more tasks after a delay to demonstrate dynamic task addition
setTimeout(()=>{
    Enqueue('send_email', {subject: 'Follow Up', to: 'testingafterdelay@gmail.com'})
}, Delay)

// Start the worker to process tasks from the queue
startWorker()