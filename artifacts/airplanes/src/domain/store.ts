import { useSyncExternalStore } from 'react';
import { createListing as makeListing, END, propose as makeProposal, START, transition as changeTrade } from './rules.ts';
import { seed } from './seed.ts';
import type { Actor, DemoState, Listing } from './types.ts';
import { initialState, parseSavedState, STORAGE_KEY } from './persistence.ts';
export { initialState, STORAGE_KEY } from './persistence.ts';
let persistenceError: string|null = null;
function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    return parseSavedState(raw);
  } catch { persistenceError='Saved demo could not be loaded. A fresh demo is shown; reset to replace invalid saved data.'; return initialState(); }
}
let state = typeof localStorage === 'undefined' ? initialState() : load();
const listeners = new Set<()=>void>();
function save(next: DemoState) {
  state = next;
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state));persistenceError=null; }
  catch { persistenceError='Browser storage is unavailable. Changes work in this tab but will not survive reload.'; }
  listeners.forEach(fn=>fn());
}
const actions = {
  setRole(role: Actor) { save({...state,role}); },
  setDate(date: string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<START||date>END) throw new Error('Choose a date within Winter 2026/27.');save({...state,date}); },
  reset() { save(initialState()); },
  createListing(input: Omit<Listing,'id'|'airline'|'status'|'createdAt'>) { save(makeListing(state,seed,input,new Date().toISOString())); },
  propose(aId:string,bId:string) { save(makeProposal(state,seed,aId,bId,new Date().toISOString())); },
  transition(id:string,action:'Accept'|'Decline'|'Approve'|'Reject') { save(changeTrade(state,seed,id,action,new Date().toISOString())); },
};
export function useDemo() {
  const snapshot = useSyncExternalStore(cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};},()=>state);
  return {state:snapshot,...actions,persistenceError};
}
