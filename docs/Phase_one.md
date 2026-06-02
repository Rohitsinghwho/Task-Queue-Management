# What was built on phase 1

## The Goal of this phase 
Understand that a task is just a serialized intent and a worker is just a loop. Nothing more

## A Naive in memory-Queue

Built a in memory FIFO data-structure and basic operations : 
- Enqueue
- Dequeue

A worker loop which basically pops a task from queue and execute it


## Key Concepts

### Task Registry

A simple dictionary or map which maps the name string -> callable function



### Task Serialization - Deserialization

- Serialization : Coverting a task + payload into a storable/ transmittable format (JSON) so it can be put on a queue , saved to DB or sent over a message broker

- Deserailization : Parsing the JSON back.




### Polling VS Blocking

There are two strategies for how a worker waits for the next job : 

#### Polling
- Worker repeatedly asks the queue "got anything ?" on a regular interval.

##### Problem with Polling
- Wastes CPU/network hitting the queue constantly.
- Latency - up to 1 full sleep interval even if the job arrives immedietely.
- The shorter the intervavl the more wasteful it is.


#### Blocking Dequeue
- Worker hangs on the dequeue call until a job arrives- the queue notifies it.
- No wasted CPU-worker sleeps at OS level
- Job gets picked up instantly when arrives
- Implemented using Redis BLPOP, BRPOP.

    