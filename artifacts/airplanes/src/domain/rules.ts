import type { Actor, DemoState, Listing, Occurrence, Seed, SlotSeries, Status, Trade, Wanted } from './types.ts';
export * from './types.ts';
export const START = '2026-10-25', END = '2027-03-27', DEFAULT_DATE = '2027-02-14';
export const addDays = (date: string, n: number) => new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const dayNumber = (date: string) => Math.round((Date.parse(date) - Date.parse(START)) / 86400000) + 1;
export const seasonDates = Array.from({ length: 154 }, (_, i) => addDays(START, i));
export const onDay = (mask: string, date: string) => mask[(new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7] === '1';
export const daysLabel = (mask: string) => mask === '1111111' ? 'Daily' : mask === '1111100' ? 'Weekdays' : ['Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays','Sundays'].filter((_, i) => mask[i] === '1').join(', ');
export const decode = (s: SlotSeries) => `${s.direction === 'D' ? 'Departure' : 'Arrival'} ${s.time}, ${daysLabel(s.daysMask)}`;
export const severity: Status[] = ['Lost','Critical','At risk','Watch','On track','Covered by lease','Secured'];
export function statusFor(used: number, total: number, remaining: number, projected: number, covered = false): Status {
  const shortfall = Math.ceil(.8 * total) - used;
  return covered ? 'Covered by lease' : shortfall <= 0 ? 'Secured' : shortfall > remaining ? 'Lost' : shortfall === remaining ? 'Critical' : projected < .8 ? 'At risk' : projected < .85 ? 'Watch' : 'On track';
}
const visibleExecutions = (trades: Trade[], date: string) => trades.filter(t => t.status === 'Executed' && t.approvalSnapshot! <= date);
export function seriesAt(s: SlotSeries, date: string, trades: Trade[]): SlotSeries {
  let result = { ...s };
  for (const t of visibleExecutions(trades, date).filter(t => t.effectiveDate! <= date && t.seriesIds.includes(s.id))) {
    const holder = t.seriesIds[0] === s.id ? t.toAirline : t.fromAirline;
    result = t.type === 'swap' ? { ...result, holder, operator: holder } : { ...result, operator: t.toAirline };
  }
  return result;
}
export function occurrencesAt(s: SlotSeries, all: Occurrence[], date: string, trades: Trade[]): Occurrence[] {
  return all.filter(o => o.seriesId === s.id).map(o => {
    const execution = visibleExecutions(trades, date).find(t => t.seriesIds.includes(s.id) && t.effectiveDate! <= o.date);
    const operator = execution ? (execution.seriesIds[0] === s.id ? execution.toAirline : execution.fromAirline) : o.operatedBy;
    return { ...o, operatedBy: operator, outcome: o.date > date ? 'scheduled' : execution?.type === 'lease' ? 'operated' : o.outcome, reason: execution?.type === 'lease' ? 'Committed lease operation' : o.reason };
  });
}
export function metrics(s: SlotSeries, all: Occurrence[], date: string, trades: Trade[] = []) {
  const occurrences = occurrencesAt(s, all, date, trades);
  const past = occurrences.filter(o => o.date <= date), future = occurrences.filter(o => o.date > date);
  const used = past.filter(o => o.outcome === 'operated' || o.outcome === 'justified').length;
  const total = occurrences.length, remaining = future.length, required = Math.ceil(.8 * total);
  const rate = past.length ? used / past.length : s.priorSeasonUtilization;
  const leased = future.filter(o => visibleExecutions(trades, date).some(t => t.type === 'lease' && t.seriesIds.includes(s.id) && t.effectiveDate! <= o.date)).length;
  const projectedUsed = used + leased + (remaining - leased) * rate;
  const projected = projectedUsed / total;
  const covered = remaining > 0 && leased === remaining;
  return { total, required, used, past: past.length, remaining, shortfall: required - used, rate, projected, projectedUsed, bestCase: used + remaining, covered, status: statusFor(used,total,remaining,projected,covered), occurrences };
}
const minutes = (t: string) => Number(t.slice(0,2)) * 60 + Number(t.slice(3));
export function fits(s: SlotSeries, wanted?: Wanted) {
  return !!wanted && s.direction === wanted.direction && s.time >= wanted.timeFrom && s.time <= wanted.timeTo && [...s.daysMask].some((d,i) => d === '1' && wanted.daysMask[i] === '1');
}
export function matchListings(a: Listing, b: Listing, series: SlotSeries[]) {
  if (a.id === b.id || a.airline === b.airline || a.status !== 'open' || b.status !== 'open' || a.term !== b.term) return null;
  const sa = series.find(s => s.id === a.seriesId), sb = series.find(s => s.id === b.seriesId);
  let pairs: [SlotSeries, Wanted][];
  if (a.type === 'swap' && b.type === 'swap' && sa && sb && fits(sa,b.wanted) && fits(sb,a.wanted)) pairs = [[sa,b.wanted!],[sb,a.wanted!]];
  else if (a.type === 'lease_out' && b.type === 'lease_in' && sa && fits(sa,b.wanted)) pairs = [[sa,b.wanted!]];
  else if (b.type === 'lease_out' && a.type === 'lease_in' && sb && fits(sb,a.wanted)) pairs = [[sb,a.wanted!]];
  else return null;
  // Average penalties: one point per 6 minutes from window midpoint and
  // five points per mismatched weekday. Stable tie-breaks use listing IDs.
  const penalty = pairs.reduce((sum,[s,w]) => sum + Math.abs(minutes(s.time) - (minutes(w.timeFrom)+minutes(w.timeTo))/2)/6 + [...s.daysMask].filter((d,i) => d !== w.daysMask[i]).length*5,0)/pairs.length;
  return { a, b, score: Math.max(0,Math.round(100-penalty)), reason: pairs.map(([s,w]) => `${decode(s)} within ${w.timeFrom}–${w.timeTo}; ${daysLabel(w.daysMask)} overlap`).join(' · ') };
}
export function available(s: SlotSeries, state: DemoState, seed: Seed) {
  return seriesAt(s,state.date,state.trades).holder === state.role && metrics(s,seed.occurrences,state.date,state.trades).remaining > 0 && !state.trades.some(t => t.status === 'Executed' && t.seriesIds.includes(s.id));
}
function audit(state: DemoState, actor: Actor, action: string, objectId: string, details: string, parties: Trade['fromAirline'][], now: string) {
  return [...state.audit, { id: `E${state.audit.length+1}`, timestamp: now, actor, action, objectId, details, parties }];
}
export function createListing(state: DemoState, seed: Seed, input: Omit<Listing,'id'|'airline'|'status'|'createdAt'>, now: string): DemoState {
  if (state.role === 'FAA') throw new Error('Only airlines can create listings.');
  if (input.term !== 'Rest of season' && input.term !== 'Rest of season plus Winter 2027/28') throw new Error('Choose a supported term.');
  if (state.date >= END) throw new Error('No future season occurrences remain.');
  if (input.type !== 'lease_in') {
    const s = seed.series.find(s => s.id === input.seriesId);
    if (!s || !available(s,state,seed)) throw new Error('Choose an available series held by your airline.');
    if (state.listings.some(l => l.seriesId === s.id && l.status !== 'closed')) throw new Error('This series already has an active listing.');
  }
  if (input.type !== 'lease_out' && (!input.wanted || !/^[01]{7}$/.test(input.wanted.daysMask) || !input.wanted.daysMask.includes('1') || input.wanted.timeFrom > input.wanted.timeTo || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.wanted.timeFrom) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.wanted.timeTo))) throw new Error('Choose a valid time window and at least one weekday.');
  if (input.priceUsd !== undefined && (!Number.isFinite(input.priceUsd) || input.priceUsd < 0)) throw new Error('Price must be a non-negative number.');
  const listing: Listing = { ...input, seriesId: input.type === 'lease_in' ? undefined : input.seriesId, wanted: input.type === 'lease_out' ? undefined : input.wanted, priceUsd: input.type === 'swap' ? undefined : input.priceUsd, id: `L${state.listings.length+1}`, airline: state.role, status: 'open', createdAt: now };
  const offered = seed.series.find(s => s.id === listing.seriesId);
  return { ...state, listings: [...state.listings, listing], audit: audit(state,state.role,'Listing created',listing.id,`${listing.type} · ${offered ? `${offered.id} · ${decode(offered)}` : 'Wanted request'}`, [state.role],now) };
}
export function propose(state: DemoState, seed: Seed, aId: string, bId: string, now: string): DemoState {
  const a = state.listings.find(l => l.id === aId), b = state.listings.find(l => l.id === bId);
  if (!a || !b || state.role === 'FAA' || a.airline !== state.role || !matchListings(a,b,seed.series)) throw new Error('Choose an open match belonging to your airline.');
  const offer = a.type === 'lease_in' ? b : a, request = offer === a ? b : a;
  const ids = [offer.seriesId!, ...(offer.type === 'swap' ? [request.seriesId!] : [])];
  if (state.trades.some(t => ['Proposed','Pending FAA approval','Executed'].includes(t.status) && t.seriesIds.some(id => ids.includes(id)))) throw new Error('A series is already committed to another trade.');
  for (const l of [offer,request].filter(l => l.seriesId)) if (!available(seed.series.find(s => s.id === l.seriesId)!, { ...state, role: l.airline },seed)) throw new Error('Offered series is unavailable.');
  const t: Trade = { id: `T${state.trades.length+1}`, type: offer.type === 'swap' ? 'swap' : 'lease', fromAirline: offer.airline, toAirline: request.airline, initiator: state.role, seriesIds: ids, listingIds: [a.id,b.id], term: a.term, priceUsd: offer.priceUsd ?? request.priceUsd, status: 'Proposed', timestamps: { proposed: now } };
  return { ...state, trades: [...state.trades,t], audit: audit(state,state.role,'Trade proposed',t.id,`${t.type}: ${t.fromAirline} → ${t.toAirline}`,[t.fromAirline,t.toAirline],now) };
}
export function transition(state: DemoState, seed: Seed, id: string, action: 'Accept'|'Decline'|'Approve'|'Reject', now: string): DemoState {
  const t = state.trades.find(t => t.id === id);
  if (!t) throw new Error('Trade not found.');
  const counterparty = t.initiator === t.fromAirline ? t.toAirline : t.fromAirline;
  const airlineAction = action === 'Accept' || action === 'Decline';
  if (airlineAction ? (state.role !== counterparty || t.status !== 'Proposed') : (state.role !== 'FAA' || t.status !== 'Pending FAA approval')) throw new Error('This actor cannot perform this transition.');
  const effectiveDate = addDays(state.date,1);
  if (action === 'Approve' || action === 'Accept') {
    if (t.listingIds.some(id => state.listings.find(l => l.id === id)?.status !== 'open')) throw new Error('A listing is no longer available.');
    if (state.trades.some(other => other.id !== id && other.status === 'Executed' && other.seriesIds.some(s => t.seriesIds.includes(s)))) throw new Error('A series is already committed.');
    for (const [i,sId] of t.seriesIds.entries()) {
      const s = seed.series.find(s => s.id === sId)!;
      if (seriesAt(s,state.date,state.trades).holder !== (i === 0 ? t.fromAirline : t.toAirline) || !seed.occurrences.some(o => o.seriesId === sId && o.date >= effectiveDate)) throw new Error('Holdings changed or no future occurrences remain.');
    }
  }
  const status = ({ Accept: 'Pending FAA approval', Decline: 'Declined', Approve: 'Executed', Reject: 'Rejected' } as const)[action];
  const key = ({ Accept: 'accepted', Decline: 'declined', Approve: 'approved', Reject: 'rejected' } as const)[action];
  const updated: Trade = { ...t, status, timestamps: { ...t.timestamps,[key]: now }, ...(action === 'Approve' ? { effectiveDate, approvalSnapshot: state.date } : {}) };
  return { ...state, trades: state.trades.map(x => x.id === id ? updated : x), listings: state.listings.map(l => action === 'Approve' && (t.listingIds.includes(l.id) || (l.seriesId && t.seriesIds.includes(l.seriesId))) ? { ...l,status: 'closed' } : l), audit: audit(state,state.role,`Trade ${status}`,id,`${t.fromAirline} → ${t.toAirline}${action === 'Approve' ? `; effective ${effectiveDate}; ${t.term}` : ''}`,[t.fromAirline,t.toAirline],now) };
}
