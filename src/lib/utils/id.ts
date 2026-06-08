import { v7 } from 'uuid';

// UUID v7 for client-generated primary keys: time-ordered (index-friendly) and
// known before the insert round-trips, so realtime echoes dedupe cleanly.
export function uuidv7(): string {
	return v7();
}
