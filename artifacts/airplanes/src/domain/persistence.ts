import { z } from 'zod';
import { seed } from './seed.ts';
import { DEFAULT_DATE, END, START } from './rules.ts';
import type { DemoState } from './types.ts';
export const STORAGE_KEY = 'airplanes-demo-v1';
export const initialState = (): DemoState => ({version:2,role:'DL',date:DEFAULT_DATE,listings:structuredClone(seed.listings),trades:[],audit:[]});
const airline = z.enum(['B6','DL','AA','BA','AS','LH']);
const actor = z.enum(['B6','DL','AA','BA','AS','LH','FAA']);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => d >= START && d <= END && new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const id = z.string().min(1);
const seriesId = id.refine(s => seed.series.some(series => series.id===s));
const term = z.enum(['Rest of season','Rest of season plus Winter 2027/28']);
const wanted = z.object({direction:z.enum(['A','D']),timeFrom:time,timeTo:time,daysMask:z.string().regex(/^[01]{7}$/).refine(s=>s.includes('1'))});
const listing = z.object({
  id,airline,type:z.enum(['swap','lease_out','lease_in']),seriesId:seriesId.optional(),wanted:wanted.optional(),term,priceUsd:z.number().nonnegative().optional(),notes:z.string().optional(),status:z.enum(['open','matched','closed']),createdAt:z.string(),
}).refine(l => l.type==='lease_in' ? !!l.wanted : !!l.seriesId && (l.type==='lease_out'||!!l.wanted));
const trade = z.object({
  id,type:z.enum(['swap','lease']),fromAirline:airline,toAirline:airline,initiator:airline,seriesIds:z.array(seriesId).min(1).max(2),listingIds:z.array(id).length(2),term,priceUsd:z.number().nonnegative().optional(),status:z.enum(['Proposed','Pending FAA approval','Executed','Declined','Rejected']),effectiveDate:date.optional(),approvalSnapshot:date.optional(),
  timestamps:z.object({proposed:z.string(),accepted:z.string().optional(),approved:z.string().optional(),declined:z.string().optional(),rejected:z.string().optional()}),
}).refine(t => t.status!=='Executed'||(!!t.effectiveDate&&!!t.approvalSnapshot));
const savedData = {
  role:actor,date,listings:z.array(listing),trades:z.array(trade),
  audit:z.array(z.object({id,timestamp:z.string(),actor,action:z.string(),objectId:id,details:z.string(),parties:z.array(airline)})),
};
const schema = z.object({version:z.literal(2),...savedData}).refine(s => s.trades.every(t => t.listingIds.every(id => s.listings.some(l=>l.id===id))));
const oldSchema = z.object({version:z.literal(1),...savedData}).refine(s => s.trades.every(t => t.listingIds.every(id => s.listings.some(l=>l.id===id))));
export function parseSavedState(raw: string): DemoState {
  const rawValue: unknown = JSON.parse(raw);
  const current = schema.safeParse(rawValue);
  if (current.success) return current.data;
  const old = oldSchema.parse(rawValue);
  // B6 was the former hard-coded default. Preserve its saved demo data while
  // moving that implicit default to the user's airline; all explicit roles stay.
  return {...old,version:2,role:old.role==='B6'?'DL':old.role};
}
