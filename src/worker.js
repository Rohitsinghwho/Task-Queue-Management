// worker.js the worker that processes tasks from the queue in loop
import { Dequeue, QueueSize } from './queue.js';
import { taskRegistry } from './task.js';

const POLLING_INTERVAL=1000; // 1 second


function processTasks(rawTaskPayload){
    const taskPayload=JSON.parse(rawTaskPayload) //deserialize the payload
    const {taskName,args}=taskPayload

    console.log(`Processing task: ${taskName} with args: ${JSON.stringify(args)}`)

    const taskHandler=taskRegistry[taskName];
    
    if(!taskHandler){
        console.error(`No handler found for task: ${taskName}`)
        return
    }

    try{
        taskHandler(args) //execute the task handler with the provided arguments
    }catch(error){
        console.error(`Error processing task: ${taskName} - ${error.message}`)
    }
}


function startWorker(){
    console.log('Worker started, polling for tasks...')

    setInterval(()=>{
        const queueSize=QueueSize()
        console.log(`Current queue size: ${queueSize}`)
        const raw=Dequeue()
        if(raw){
            processTasks(raw)
            console.log(`Finished processing task. Remaining queue size: ${QueueSize()}`)
        }

    }, POLLING_INTERVAL)
}

export {startWorker}
