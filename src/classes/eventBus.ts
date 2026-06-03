/**
 * Typed event bus for queue lifecycle events.
 *
 * This centralizes event emission for SSE and any observers.
 */
import {EventEmitter} from 'events';
import {QueueEvents} from '../interfaces/QueueEvents.js';



class EventBus extends EventEmitter {
    // Narrow event names and payload types for better safety.
    emit(event: 'queue',data:QueueEvents): boolean {
        return super.emit(event, data);
    }

    on(event:'queue',listener:(data:QueueEvents)=>void): this {
        return super.on(event, listener);
    }

    off(event:'queue',listener:(data:QueueEvents)=>void): this {
        return super.off(event, listener);
    }
}

// Singleton instance shared across the application.
export const eventBus = new EventBus();

