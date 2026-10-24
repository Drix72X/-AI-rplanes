import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, seed } from './seed.ts';
import { addDays, createListing, dayNumber, decode, DEFAULT_DATE, END, matchListings, metrics, onDay, propose, seasonDates, seriesAt, START, statusFor, transition } from './rules.ts';
import type { DemoState, Listing } from './types.ts';
const fresh = (): DemoState => ({version:2,role:'B6',date:DEFAULT_DATE,listings:structuredClone(seed.listings),trades:[],audit:[]});
const hero = seed.series[0];
const now = '2026-10-24T12:00:00Z';
function heroProposal() {
  let state = createListing(fresh(),seed,{type:'lease_out',seriesId:hero.id,term:'Rest of season'},now);
  state = propose(state,seed,state.listings.at(-1)!.id,'L1',now);
  return state;
}
function executedLease() {
  let state = heroProposal();
  state = transition({...state,role:'DL'},seed,'T1','Accept',now);
  return transition({...state,role:'FAA'},seed,'T1','Approve',now);
}
test('UTC season, day numbering and Monday-first masks', () => {
  assert.equal(seasonDates.length,154); assert.equal(seasonDates[0],START); assert.equal(seasonDates.at(-1),END);
  assert.equal(dayNumber(DEFAULT_DATE),113); assert.equal(dayNumber(END),154);
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
  assert.equal(seasonDates.filter(d=>onDay('0010000',d)).length,22);
  assert.equal(seasonDates.filter(d=>onDay('1111100',d)).length,110);
  assert.match(decode(hero),/Departure 07:30, Wednesdays/);
});
test('repeatable 300-series seed and exact airline counts; reserved sequence IDs unique', () => {
  assert.deepEqual(createSeed(),seed);
  assert.equal(seed.series.length,300);
  assert.equal(new Set(seed.series.map(s=>s.id.slice(-4))).size,300);
  for(const [code,count] of Object.entries({B6:90,DL:90,AA:45,BA:27,AS:24,LH:24})) assert.equal(seed.series.filter(s=>s.holder===code).length,count);
  assert.ok(!seed.listings.some(l=>l.seriesId===hero.id));
  assert.equal(seed.listings.length,14);
  for(const s of seed.series) assert.ok(s.priorSeasonUtilization>=.82&&s.priorSeasonUtilization<=.99);
});
test('hero snapshots and immutable underlying outcomes', () => {
  const original = JSON.stringify(seed);
  const nov = metrics(hero,seed.occurrences,'2026-11-01');
  assert.equal(nov.used,1);assert.equal(nov.past,1);assert.equal(nov.status,'On track');
  const dec = metrics(hero,seed.occurrences,'2026-12-01');
  assert.equal(dec.used,4);assert.equal(dec.past,5);assert.equal(dec.status,'Watch');
  const feb = metrics(hero,seed.occurrences,DEFAULT_DATE);
  assert.deepEqual([feb.used,feb.past,feb.required,feb.total,feb.remaining,feb.status],[12,16,18,22,6,'Critical']);
  assert.equal(metrics(hero,seed.occurrences,START).rate,.84);
  assert.equal(JSON.stringify(seed),original);
  assert.deepEqual(seed.occurrences.filter(o=>o.seriesId===hero.id&&o.outcome==='cancelled').map(o=>[o.date,o.reason]),[['2026-11-25','Commercial'],['2026-12-23','Crew'],['2027-01-13','Commercial'],['2027-02-10','Mechanical']]);
});
test('all planted counts, justified credit and exact initial portfolio severity', () => {
  const counts: Record<string,number>={};
  seed.series.filter(s=>s.holder==='B6').forEach(s=>{const {status}=metrics(s,seed.occurrences,DEFAULT_DATE);counts[status]=(counts[status]??0)+1;});
  assert.deepEqual(counts,{'Critical':1,'On track':85,'Lost':1,'Watch':3});
  const lost=metrics(seed.series[3],seed.occurrences,DEFAULT_DATE);
  assert.deepEqual([lost.used,lost.past,lost.bestCase,lost.required],[55,80,85,88]);
  for(const [n,used] of [[5,93],[6,94],[7,95]]) {
    const m=metrics(seed.series[n-1],seed.occurrences,DEFAULT_DATE);
    assert.equal(m.used,used);assert.equal(m.status,'Watch');
    assert.equal(m.occurrences.filter(o=>o.date<=DEFAULT_DATE&&o.outcome==='justified').length,3);
  }
  for(const n of [11,12,13]) {
    const m=metrics(seed.series[n-1],seed.occurrences,DEFAULT_DATE);
    assert.equal(m.status,'At risk');assert.ok(m.projected>=.75&&m.projected<=.79);
  }
});
test('status precedence, ceilings and exact 80/85 percent boundaries', () => {
  assert.equal(statusFor(0,22,22,.5,true),'Covered by lease');
  assert.equal(statusFor(18,22,0,.82),'Secured');
  assert.equal(statusFor(11,22,6,.95),'Lost');
  assert.equal(statusFor(12,22,6,.95),'Critical');
  assert.equal(statusFor(13,22,6,.799),'At risk');
  assert.equal(statusFor(13,22,6,.8),'Watch');
  assert.equal(statusFor(13,22,6,.8499),'Watch');
  assert.equal(statusFor(13,22,6,.85),'On track');
});
test('lease matching and reciprocal swap; mismatches never match', () => {
  const state=heroProposal(), out=state.listings.at(-1)!, request=state.listings[0];
  assert.equal(matchListings(out,request,seed.series)?.score,100);
  assert.equal(matchListings(seed.listings[1],seed.listings[2],seed.series)?.score,100);
  for(const patch of [{direction:'A'},{timeFrom:'08:00',timeTo:'09:00'},{daysMask:'1000000'}]) {
    assert.equal(matchListings(out,{...request,wanted:{...request.wanted!,...patch} as Listing['wanted']},seed.series),null);
  }
  assert.equal(matchListings(seed.listings[3],seed.listings[4],seed.series),null,'P1 cycle is not a reciprocal swap');
  assert.equal(matchListings(out,{...request,term:'Rest of season plus Winter 2027/28'},seed.series),null);
});
test('lease executes only after counterparty and FAA; ownership/history preserved', () => {
  let state=heroProposal();
  assert.equal(metrics(hero,seed.occurrences,state.date,state.trades).status,'Critical');
  assert.throws(()=>transition({...state,role:'FAA'},seed,'T1','Approve',now));
  assert.throws(()=>transition(state,seed,'T1','Accept',now));
  state=transition({...state,role:'DL'},seed,'T1','Accept',now);
  assert.equal(metrics(hero,seed.occurrences,state.date,state.trades).status,'Critical');
  assert.throws(()=>transition(state,seed,'T1','Approve',now));
  state=transition({...state,role:'FAA'},seed,'T1','Approve',now);
  const m=metrics(hero,seed.occurrences,state.date,state.trades);
  assert.equal(m.status,'Covered by lease');assert.equal(m.projectedUsed,18);assert.equal(m.projected,18/22);
  assert.equal(m.used,12);assert.equal(state.trades[0].effectiveDate,'2027-02-15');
  assert.equal(seriesAt(hero,'2027-02-15',state.trades).holder,'B6');
  assert.equal(seriesAt(hero,'2027-02-15',state.trades).operator,'DL');
  assert.deepEqual(m.occurrences.filter(o=>o.date<=DEFAULT_DATE),metrics(hero,seed.occurrences,DEFAULT_DATE).occurrences.filter(o=>o.date<=DEFAULT_DATE));
  assert.ok(m.occurrences.filter(o=>o.date>DEFAULT_DATE).every(o=>o.operatedBy==='DL'));
  assert.equal(state.audit.length,4);
  assert.deepEqual(state.audit.map(e=>e.action),['Listing created','Trade proposed','Trade Pending FAA approval','Trade Executed']);
  assert.equal(state.listings[0].status,'closed');assert.equal(state.listings.at(-1)!.status,'closed');
  assert.throws(()=>transition(state,seed,'T1','Approve',now));
});
test('changing snapshots derives history and cannot re-execute trades', () => {
  const state=executedLease(), serialized=JSON.stringify(state);
  assert.equal(metrics(hero,seed.occurrences,'2026-11-01',state.trades).status,'On track');
  assert.equal(metrics(hero,seed.occurrences,'2027-02-13',state.trades).status,'Critical');
  assert.equal(metrics(hero,seed.occurrences,'2027-02-17',state.trades).used,13);
  assert.equal(metrics(hero,seed.occurrences,END,state.trades).used,18);
  assert.equal(metrics(hero,seed.occurrences,END,state.trades).status,'Secured');
  assert.equal(JSON.stringify(state),serialized);
});
test('swaps exchange holders only at effective date; preserve all past operators', () => {
  let state=propose(fresh(),seed,'L2','L3',now);
  state=transition({...state,role:'AA'},seed,'T1','Accept',now);
  assert.equal(seriesAt(seed.series[1],DEFAULT_DATE,state.trades).holder,'B6');
  state=transition({...state,role:'FAA'},seed,'T1','Approve',now);
  assert.equal(seriesAt(seed.series[1],DEFAULT_DATE,state.trades).holder,'B6');
  assert.equal(seriesAt(seed.series[1],'2027-02-15',state.trades).holder,'AA');
  assert.equal(seriesAt(seed.series[2],'2027-02-15',state.trades).holder,'B6');
  assert.equal(metrics(seed.series[1],seed.occurrences,'2027-02-15',state.trades).occurrences.find(o=>o.date==='2027-02-14')!.operatedBy,'B6');
  assert.equal(metrics(seed.series[1],seed.occurrences,'2027-02-15',state.trades).occurrences.find(o=>o.date==='2027-02-15')!.operatedBy,'AA');
});
test('decline and rejection are terminal with no effect on utilization', () => {
  for(const action of ['Decline','Reject'] as const) {
    let state=heroProposal();
    if(action==='Reject') state=transition({...state,role:'DL'},seed,'T1','Accept',now);
    state=transition({...state,role:action==='Decline'?'DL':'FAA'},seed,'T1',action,now);
    assert.equal(state.trades[0].status,action==='Decline'?'Declined':'Rejected');
    assert.equal(metrics(hero,seed.occurrences,DEFAULT_DATE,state.trades).status,'Critical');
    assert.ok(state.listings.every(l=>l.status==='open'));
    assert.throws(()=>transition({...state,role:'FAA'},seed,'T1','Approve',now));
  }
});
test('invalid listings, duplicate/conflicting trades and season-end execution rejected', () => {
  assert.throws(()=>createListing({...fresh(),role:'FAA'},seed,{type:'lease_out',seriesId:hero.id,term:'Rest of season'},now));
  assert.throws(()=>createListing({...fresh(),role:'DL'},seed,{type:'lease_out',seriesId:hero.id,term:'Rest of season'},now));
  const state=heroProposal();
  assert.throws(()=>propose(state,seed,state.listings.at(-1)!.id,'L1',now));
  assert.throws(()=>createListing(state,seed,{type:'lease_out',seriesId:hero.id,term:'Rest of season'},now));
  assert.throws(()=>createListing(fresh(),seed,{type:'lease_in',term:'Rest of season',wanted:{direction:'D',timeFrom:'09:00',timeTo:'08:00',daysMask:'0000000'}},now));
  assert.throws(()=>transition({...state,role:'DL',date:END},seed,'T1','Accept',now));
  const accepted=transition({...state,role:'DL'},seed,'T1','Accept',now);
  assert.throws(()=>transition({...accepted,role:'FAA',date:'2027-03-24'},seed,'T1','Approve',now));
});
test('next-season term is metadata only and explicit terms/price survive serialization', () => {
  let state=fresh();
  state.listings[0].term='Rest of season plus Winter 2027/28';
  state=createListing(state,seed,{type:'lease_out',seriesId:hero.id,term:'Rest of season plus Winter 2027/28',priceUsd:150000,notes:'Demo only'},now);
  state=propose(state,seed,state.listings.at(-1)!.id,'L1',now);
  state=transition({...state,role:'DL'},seed,'T1','Accept',now);
  state=transition({...state,role:'FAA'},seed,'T1','Approve',now);
  const restored=JSON.parse(JSON.stringify(state));
  assert.equal(restored.trades[0].priceUsd,150000);
  assert.equal(restored.trades[0].term,'Rest of season plus Winter 2027/28');
  assert.equal(metrics(hero,seed.occurrences,END,restored.trades).total,22);
});
