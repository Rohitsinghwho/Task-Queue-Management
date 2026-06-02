// queue.js a simple in memory queue implementation

const queue=[];

export function Enqueue(taskName, args){
    // create a payload object with the task name and arguments
    const payload={
        taskName,
        args
    }

    // serialize the payload to a string (optional, but can be useful for logging or debugging)
    const serializedPayload=JSON.stringify(payload)
    // push the payload to the queue
    queue.push(serializedPayload)
    console.log(`Enqueuing task: ${serializedPayload} and queue size is ${queue.length}`)
}


export function Dequeue(){
    if(queue.length===0){
        console.log('Queue is empty')
        return null
    }
    // remove the first element from the queue and return it
    return queue.shift()
}

export function QueueSize(){
    return queue.length
}
