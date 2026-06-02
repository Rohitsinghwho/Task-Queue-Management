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

```
export const taskRegistry={
    "send_email": sendEmail,
    "resize_image": resizeImage,
    "generate_report": generateReport
};

```


### Task Serialization - Deserialization

- Serialization : Coverting a task + payload into a storable/ transmittable format (JSON) so it can be put on a queue , saved to DB or sent over a message broker

```
const payload={
        taskName,
        args
    }

    // serialize the payload to a string (optional, but can be useful for logging or debugging)
    const serializedPayload=JSON.stringify(payload)

```

- Deserailization : Parsing the JSON back.

```
const raw=Dequeue()
const taskPayload=JSON.parse(rawTaskPayload) //deserialize the payload
const {taskName,args}=taskPayload


```




### Polling VS Blocking

There are two strategies for how a worker waits for the next job : 

#### Polling
- Worker repeatedly asks the queue "got anything ?" on a regular interval.

```
    const POLLING_INTERVAL=1000;
    setInterval(()=>{
        const queueSize=QueueSize()
        console.log(`Current queue size: ${queueSize}`)
        const raw=Dequeue()
        if(raw){
            processTasks(raw)
            console.log(`Finished processing task. Remaining queue size: ${QueueSize()}`)
        }

    }, POLLING_INTERVAL)

```

Output of polling is 

```
Current queue size: 1
Processing task: generate_report with args: {"userId":123,"reportType":"sales"}
Generating sales report for user 123
Report generation completed for sales
Finished processing task. Remaining queue size: 0
Current queue size: 0
Queue is empty
Current queue size: 0
Queue is empty
Current queue size: 0
Queue is empty
Current queue size: 0
Queue is empty
Current queue size: 0
Queue is empty
Current queue size: 0
Queue is empty
Current queue size: 0
Queue is empty
Current queue size: 0
Queue is empty
Current queue size: 0
Queue is empty
Current queue size: 0
Queue is empty
Enqueuing task: {"taskName":"send_email","args":{"subject":"Follow Up","to":"testingafterdelay@gmail.com"}} and queue size is 1
Current queue size: 1
Processing task: send_email with args: {"subject":"Follow Up","to":"testingafterdelay@gmail.com"}
Email sent to testingafterdelay@gmail.com with subject: Follow Up
Email sending completed for testingafterdelay@gmail.com

```
##### Problem with Polling
- Wastes CPU/network hitting the queue constantly.
- Latency - up to 1 full sleep interval even if the job arrives immedietely.
- The shorter the intervavl the more wasteful it is.


#### Blocking Dequeue
- Worker hangs on the dequeue call until a job arrives- the queue notifies it.
- No wasted CPU-worker sleeps at OS level
- Job gets picked up instantly when arrives
- Implemented using Redis BLPOP, BRPOP.

    

### Output For Phase One

Before Starting worker

```
> distributed-task-queue-management@1.0.0 run
> node src/main.js

Enqueuing task: {"taskName":"send_email","args":{"subject":"Hello World","to":"rohitsingh16@gmail.com"}} and queue size is 1
Enqueuing task: {"taskName":"resize_image","args":{"imagePath":"/path/to/image.jpg","width":800,"height":600}} and queue size is 2
Enqueuing task: {"taskName":"generate_report","args":{"userId":123,"reportType":"sales"}} and queue size is 3
Worker started, polling for tasks...
Current queue size: 3
Processing task: send_email with args: {"subject":"Hello World","to":"rohitsingh16@gmail.com"}
Email sent to rohitsingh16@gmail.com with subject: Hello World
Email sending completed for rohitsingh16@gmail.com
Finished processing task. Remaining queue size: 2
Current queue size: 2
Processing task: resize_image with args: {"imagePath":"/path/to/image.jpg","width":800,"height":600}
Resizing image at /path/to/image.jpg to 800x600

pressed ctrl+C to stop the process in between

```

After Intentionaly crashing the worker and restarting it 

```
> distributed-task-queue-management@1.0.0 run
> node src/main.js

Enqueuing task: {"taskName":"send_email","args":{"subject":"Hello World","to":"rohitsingh16@gmail.com"}} and queue size is 1
Enqueuing task: {"taskName":"resize_image","args":{"imagePath":"/path/to/image.jpg","width":800,"height":600}} and queue size is 2
Enqueuing task: {"taskName":"generate_report","args":{"userId":123,"reportType":"sales"}} and queue size is 3
Worker started, polling for tasks...
Current queue size: 3
Processing task: send_email with args: {"subject":"Hello World","to":"rohitsingh16@gmail.com"}
Email sent to rohitsingh16@gmail.com with subject: Hello World
Email sending completed for rohitsingh16@gmail.com
Finished processing task. Remaining queue size: 2
Current queue size: 2
Processing task: resize_image with args: {"imagePath":"/path/to/image.jpg","width":800,"height":600}
Resizing image at /path/to/image.jpg to 800x600


```
The task are not persisted in the queue and the worker is again executing the same task.
