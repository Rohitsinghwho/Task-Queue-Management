# What was built on phase 2

## The Goal of this phase
Move from in-memory to a persistent queue so producer and worker can run independently, and jobs survive restarts.

## Redis List as the Queue
Replaced the in-memory array with a Redis List for FIFO job storage.

- Enqueue: `LPUSH jobs <job>`
- Dequeue: `BRPOP jobs <timeout>`

The queue name is centralized as `QUEUE_NAME = "jobs"`.

## Producer and Worker Split
Created separate processes so producers and workers are decoupled.

- Producer enqueues jobs in `producer.js`.
- Worker consumes jobs in `worker.js`.
- `worker_start.js` starts the worker in its own terminal.

This is the core of a distributed queue: producers and consumers can scale separately.

## Job Envelope
Jobs are now real objects with metadata before being serialized and pushed to Redis.

```
{
  id: <uuid>,
  type: <taskName>,
  args: <payload>,
  status: "pending",
  createdAt: <timestamp>
}
```

This makes jobs traceable and ready for future features like retries and leasing.

## Blocking Dequeue
Switched to `BRPOP` so the worker blocks until a job arrives.

- No CPU waste from polling
- Instant pickup when a job is enqueued
- Simpler worker loop

## Persistence Check
Because Redis persists the list, jobs survive worker crashes and Redis restarts.
The producer includes a quick checklist to verify durability after a restart.

## Phase 2 Notes
Phase 2 still has no retry or lease/visibility timeout.
If a worker crashes after `BRPOP` but before completing, the job is lost.
This is the reliability gap that Phase 3 will address.

## Output For Phase Two

Before Redis worker killed mid execution of executing a job

```
Worker connected to Redis, waiting for jobs...
listening on key jobs
Received job from queue jobs: {"id":"adfea819-62e6-4384-b94f-1d27a5a26381","type":"send_email","args":{"subject":"Hello World","to":"user@example.com"},"status":"pending","createdAt":"1780423829949"}
Worker started, waiting for jobs...
Processing job adfea819-62e6-4384-b94f-1d27a5a26381 of type send_email
Email sent to user@example.com with subject: Hello World
Email sending completed for user@example.com
Job adfea819-62e6-4384-b94f-1d27a5a26381 completed successfully
Received job from queue jobs: {"id":"594516b1-5977-4f56-a545-af7da0a0987f","type":"resize_image","args":{"imagePath":"/path/to/image.jpg","width":800,"height":600},"status":"pending","createdAt":"1780423830032"}
Worker started, waiting for jobs...
Processing job 594516b1-5977-4f56-a545-af7da0a0987f of type resize_image
Resizing image at /path/to/image.jpg to 800x600
Image resizing completed for /path/to/image.jpg
Job 594516b1-5977-4f56-a545-af7da0a0987f completed successfully
Received job from queue jobs: {"id":"d2fa784e-17f3-4348-98c6-d9a8df26c067","type":"generate_report","args":{"userId":123,"reportType":"sales"},"status":"pending","createdAt":"1780423830112"}
Worker started, waiting for jobs...
Processing job d2fa784e-17f3-4348-98c6-d9a8df26c067 of type generate_report
Generating sales report for user 123
Report generation completed for sales
Job d2fa784e-17f3-4348-98c6-d9a8df26c067 completed successfully
Received job from queue jobs: {"id":"fdbd193f-21ab-4eba-b45a-61bb8d1c1751","type":"send_email","args":{"subject":"Follow Up","to":"user2@example.com"},"status":"pending","createdAt":"1780423830192"}
Worker started, waiting for jobs...
Processing job fdbd193f-21ab-4eba-b45a-61bb8d1c1751 of type send_email
Email sent to user2@example.com with subject: Follow Up
Email sending completed for user2@example.com
Job fdbd193f-21ab-4eba-b45a-61bb8d1c1751 completed successfully
Received job from queue jobs: {"id":"bca69018-b829-4a81-bd2c-a9442473105b","type":"generate_report","args":{"userId":124,"reportType":"marketing"},"status":"pending","createdAt":"1780423830272"}
Worker started, waiting for jobs...
Processing job bca69018-b829-4a81-bd2c-a9442473105b of type generate_report
Generating marketing report for user 124
Report generation completed for marketing
Job bca69018-b829-4a81-bd2c-a9442473105b completed successfully
Received job from queue jobs: {"id":"863c98e5-370d-40e5-ae7d-cf36e3db2f54","type":"generate_report","args":{"userId":125,"reportType":"promotions"},"status":"pending","createdAt":"1780423830352"}
Worker started, waiting for jobs...
Processing job 863c98e5-370d-40e5-ae7d-cf36e3db2f54 of type generate_report
Generating promotions report for user 125

```

After redis worker restarted

```
Worker connected to Redis, waiting for jobs...
listening on key jobs
Received job from queue jobs: {"id":"581c78ad-b4a4-4a1d-b495-55e4d9cbc22d","type":"generate_report","args":{"userId":126,"reportType":"sales"},"status":"pending","createdAt":"1780423830433"}
Worker started, waiting for jobs...
Processing job 581c78ad-b4a4-4a1d-b495-55e4d9cbc22d of type generate_report
Generating sales report for user 126
Report generation completed for sales
Job 581c78ad-b4a4-4a1d-b495-55e4d9cbc22d completed successfully
Received job from queue jobs: {"id":"a2edef05-c245-4322-b498-d37c667ebd71","type":"send_email","args":{"subject":"Hello World","to":"user3@example.com"},"status":"pending","createdAt":"1780423830516"}
Worker started, waiting for jobs...
Processing job a2edef05-c245-4322-b498-d37c667ebd71 of type send_email
Email sent to user3@example.com with subject: Hello World
Email sending completed for user3@example.com
Job a2edef05-c245-4322-b498-d37c667ebd71 completed successfully

```

we can see that the job 863c98e5-370d-40e5-ae7d-cf36e3db2f54 was not completed and when i restarted the next job in the queue was picked up and 863c98e5-370d-40e5-ae7d-cf36e3db2f54 this job was lost.