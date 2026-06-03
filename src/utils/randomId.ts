/**
 * Random id generator for job ids.
 */
import {v4 as uuidv4} from 'uuid';

export function generateRandomId(): string {
    return uuidv4();
}