// Single abstraction layer for all data operations.
// Components never import supabase.ts directly — they go through here.
// This makes future offline/IndexedDB support a contained change.

export { supabase } from './supabase';
