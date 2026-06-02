# Project Overview

A Production Grade distributed task queue built from scratch, covering persistence, reliability , durability , concurrency. Built to understand how real systems like Celery , BullMQ and SQS work under the hood.

## What Problem does it solve ?
Why does task queue exists ? What breaks without it ?

- What happens when you process all the task synchronously
- Why you need background job processing ?
- real examples (sending emails, notifications)

## High Level Architecture

```
                 Producer
                    ↓
            Queue(Redis as a queue)
                    ↓
            Worker(Consumes the task)
                    ↓
                ACK Fail
                    ↓
        Dead Letter Queue(moved for retry)
                
```
- Producer : Producer is who adds the task to the queue like a task such as _send email_ is a task.

- Queue : Queue is a Data-Structure that stores the Items in FIFO order we are using redis as queue here due to its vast features.

- Worker : Worker is who consumes a task and executes that task in the background asynchronoulsy.

- ACK : ACK is the shorthand for Acknowledgement when a task is executed the ACK is pass otherwise fail.

- Dead Letter Queue : A Queue which can be implemented using redis as well for maintaining tasks whose ACK is failed or got a timeout they are stored here for retrying with limits.

- Lease/visibility Timeout : Lease is a timestamp that means for that duration other workers won't be able to pickup that task and it will not be visible during that time.

- Idempotency : An operation is idempotent if running it multiple times produces the same exact result.

- BackOff - Jitters : 


## Tech Stack and Why ?

- Language : Nodejs (cause i was familiar with it)
- Queue Store : Redis 
- Why this stack - Cause Redis handles millions of writes per seconds without failing and also it has persistence options which are durable enough for this project. Redis offers List type which exposes rich features for implementing queue.




