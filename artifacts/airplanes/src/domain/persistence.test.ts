import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, parseSavedState } from './persistence.ts';
import { seed } from './seed.ts';
import { createListing, propose, transition } from './rules.ts';
test('persist/reload retains executed lease, terms, date, role and full audit trail',()=>{
  // B6 is a selectable counterparty in the seeded rescue scenario.
  let s=createListing({...initialState(),role:'B6'},seed,{type:'lease_out',seriesId:seed.series[0].id,term:'Rest of season',notes:'Rescue',priceUsd:120000},'2026-10-24T10:00:00Z');
  s=propose(s,seed,s.listings.at(-1)!.id,'L1','2026-10-24T10:01:00Z');
  s=transition({...s,role:'DL'},seed,'T1','Accept','2026-10-24T10:02:00Z');
  s=transition({...s,role:'FAA'},seed,'T1','Approve','2026-10-24T10:03:00Z');
  assert.deepEqual(parseSavedState(JSON.stringify(s)),JSON.parse(JSON.stringify(s)));
});
test('malformed nested saved state fails explicitly; reset is independent and deterministic',()=>{
  for(const value of [{}, {...initialState(),trades:[{id:'T1'}]}, {...initialState(),date:'2027-02-30'}, {...initialState(),listings:[{id:'L1'}]}]) assert.throws(()=>parseSavedState(JSON.stringify(value)));
  assert.throws(()=>parseSavedState('{not JSON'));
  const a=initialState();a.listings[0].status='closed';a.role='FAA';
  assert.deepEqual(initialState().listings,seed.listings);
  assert.equal(initialState().role,'DL');
  assert.equal(initialState().date,'2027-02-14');
  assert.deepEqual(initialState().audit,[]);
});
test('legacy B6-default saves migrate to Delta without discarding listings, trades or audit',()=>{
  const old={...initialState(),version:1 as const,role:'B6' as const,listings:seed.listings, trades:[],audit:[{id:'E1',timestamp:'2026-10-24T10:00:00Z',actor:'B6' as const,action:'Test event',objectId:'L1',details:'Keep me',parties:['B6' as const]}]};
  const migrated=parseSavedState(JSON.stringify(old));
  assert.equal(migrated.version,2);assert.equal(migrated.role,'DL');assert.equal(migrated.audit[0].details,'Keep me');
  assert.deepEqual(migrated.listings,JSON.parse(JSON.stringify(seed.listings)));
  const selectedAirline={...old,role:'AA' as const};
  assert.equal(parseSavedState(JSON.stringify(selectedAirline)).role,'AA');
});
