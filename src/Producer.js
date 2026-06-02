// producer.js - enqueue tasks to the queue seperately
// Phase 1: Producer creates tasks and pushes to in memory array and worker pulls from it in the same process main.js
// Phase 2: Producer creates tasks and pushes to Redis List and worker pulls from it in a separate process worker.js

// This is the whole point of queue management system, to decouple the producer and consumer and allow them to run independently and scale separately

import { Enqueue } from "./queue.js";
import client from "./redisClient/client.js";

async function main() {
  console.log("Producer started");

  await Enqueue("send_email", {
    subject: "Hello World",
    to: "user@example.com",
  });
  await Enqueue("resize_image", {
    imagePath: "/path/to/image.jpg",
    width: 800,
    height: 600,
  });
  await Enqueue("generate_report", { userId: 123, reportType: "sales" });
  await Enqueue("send_email", {
    subject: "Follow Up",
    to: "user2@example.com",
  });
  // await Enqueue('data_backup', {backupType: 'full', destination: 's3://backups/full-backup.zip'});
  await Enqueue("generate_report", { userId: 124, reportType: "marketing" });
  await Enqueue("generate_report", { userId: 125, reportType: "promotions" });
  await Enqueue("generate_report", { userId: 126, reportType: "sales" });
  await Enqueue("send_email", {
    subject: "Hello World",
    to: "user3@example.com",
  });

  console.log("All tasks enqueued");
  console.log(`\nCurrent queue length: ${await client.lLen("jobs")}`);
  console.log(
    "\nRun the worker in a separate terminal to start processing tasks",
  );
  console.log('\nUse "node worker.js" to start the worker');
  console.log("\n To check persistence: ");
  console.log("   1. Run this producer: node producer.js");
  console.log("   2. Don't start the worker yet");
  console.log("   3. Restart your machine / stop Redis and restart it");
  console.log("   4. Start the worker — jobs are still there ✓\n");

  await client.disconnect();
}

main();


