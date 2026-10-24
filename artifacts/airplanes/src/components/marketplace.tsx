import { useEffect, useMemo, useState } from 'react';
import { Plus, Store, ArrowRightLeft, Inbox, Handshake } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDemo } from '@/domain/store';
import { seed } from '@/domain/seed';
import { available, matchListings, decode, daysLabel, metrics, seriesAt } from '@/domain/rules';
import type { Listing, Term, Trade } from '@/domain/types';
import { AirlineTag, Btn, Empty, Panel, SlotCode, TradeChip, StatusChip, fieldCls, fmtStamp, occBySeries, pct, seriesById, td, th, typeLabel, usd, useRun } from './kit';
import type { Prefill } from './utilization';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Sub = 'browse' | 'mine' | 'matches' | 'trades';

function Wanted({ l }: { l: Listing }) {
  if (!l.wanted) return <span className="text-muted-foreground">Nothing</span>;
  const w = l.wanted;
  return <span>{w.direction === 'D' ? 'Departure' : 'Arrival'} <span className="tnum font-mono">{w.timeFrom}–{w.timeTo}</span>, {daysLabel(w.daysMask)}</span>;
}

export function Marketplace({ prefill, clearPrefill }: { prefill: Prefill | null; clearPrefill: () => void }) {
  const { state } = useDemo();
  const [sub, setSub] = useState<Sub>(() => state.role === 'DL' ? 'mine' : 'browse');
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (prefill) setCreating(true); }, [prefill]);
  const isFAA = state.role === 'FAA';
  const mine = state.listings.filter(l => l.airline === state.role);
  const matches = useMemo(() => isFAA ? [] : mine.flatMap(a => state.listings.map(b => matchListings(a, b, seed.series)).filter(Boolean) as NonNullable<ReturnType<typeof matchListings>>[]).sort((x, y) => y.score - x.score),
    [state.listings, state.role]); // eslint-disable-line
  const myTrades = state.trades.filter(t => isFAA || t.fromAirline === state.role || t.toAirline === state.role);
  const pendingMine = myTrades.filter(t => t.status === 'Proposed' && t.initiator !== state.role).length;
  const tabs: [Sub, string, number?][] = [['browse', 'Browse listings', state.listings.filter(l => l.status === 'open').length], ...(isFAA ? [] : [['mine', 'My listings', mine.length], ['matches', 'Matches', matches.length]] as [Sub, string, number][]), ['trades', 'Trades', pendingMine || myTrades.length]];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex gap-1 overflow-x-auto rounded-md border bg-card p-0.5">
          {tabs.map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={sub === k} data-testid={`tab-${k}`} onClick={() => setSub(k)}
              className={cn('flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs font-semibold transition-colors', sub === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
              {l}<span className={cn('tnum rounded-sm px-1 font-mono text-[10px]', sub === k ? 'bg-primary-foreground/20' : 'bg-muted')}>{n}</span>
            </button>
          ))}
        </div>
        {!isFAA && <Btn variant="primary" data-testid="button-create-listing" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />{state.role === 'DL' ? 'Offer a slot' : 'New listing'}</Btn>}
      </div>
      {sub === 'browse' && <Browse />}
      {sub === 'mine' && <Mine listings={mine} />}
      {sub === 'matches' && <Matches matches={matches} />}
      {sub === 'trades' && <Trades trades={myTrades} />}
      {creating && <CreateListing prefill={prefill} onClose={done => { setCreating(false); clearPrefill(); if (done) setSub('matches'); }} />}
    </div>
  );
}

function ListingTable({ listings, showStatus }: { listings: Listing[]; showStatus?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="tnum w-full min-w-[900px] text-xs">
        <thead><tr>{['ID', 'Airline', 'Type', 'Offered', 'Wanted', 'Term', 'Price', 'Posted', ...(showStatus ? ['Status'] : [])].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{listings.map(l => (
          <tr key={l.id} className="border-t hover:bg-accent/40" data-testid={`row-listing-${l.id}`}>
            <td className={cn(td, 'font-mono')}>{l.id}</td>
            <td className={td}><AirlineTag code={l.airline} /></td>
            <td className={td}>{typeLabel(l.type)}</td>
            <td className={td}><SlotCode s={l.seriesId ? seriesById.get(l.seriesId) : undefined} /></td>
            <td className={td}><Wanted l={l} />{l.notes && <div className="max-w-[220px] truncate text-muted-foreground" title={l.notes}>{l.notes}</div>}</td>
            <td className={td}>{l.term}</td>
            <td className={cn(td, 'font-mono')}>{usd(l.priceUsd)}</td>
            <td className={cn(td, 'font-mono text-muted-foreground')}>{l.createdAt.slice(0, 10)}</td>
            {showStatus && <td className={cn(td, 'capitalize')}>{l.status}</td>}
          </tr>))}</tbody>
      </table>
    </div>
  );
}

function Browse() {
  const { state } = useDemo();
  const [type, setType] = useState('all');
  const [dir, setDir] = useState('all');
  const list = state.listings.filter(l => l.status === 'open' && (type === 'all' || l.type === type) &&
    (dir === 'all' || (l.seriesId ? seriesById.get(l.seriesId)?.direction : l.wanted?.direction) === dir));
  return (
    <Panel title={`Open listings · ${list.length}`} right={<div className="flex gap-2">
      <select aria-label="Type filter" className={fieldCls} value={type} onChange={e => setType(e.target.value)}><option value="all">All types</option><option value="swap">Swap</option><option value="lease_out">Lease out</option><option value="lease_in">Lease in</option></select>
      <select aria-label="Direction filter" className={fieldCls} value={dir} onChange={e => setDir(e.target.value)}><option value="all">Arr + Dep</option><option value="A">Arrival</option><option value="D">Departure</option></select>
    </div>}>
      {list.length ? <ListingTable listings={[...list].reverse()} /> : <Empty icon={Store} title="No open listings" body="Nothing matches these filters right now." />}
    </Panel>
  );
}

function Mine({ listings }: { listings: Listing[] }) {
  return <Panel title={`My listings · ${listings.length}`}>{listings.length ? <ListingTable listings={[...listings].reverse()} showStatus /> : <Empty icon={Inbox} title="You have no listings" body="Open a series from Utilization and choose Lease out or Find a swap, or post a lease-in request." />}</Panel>;
}

function Matches({ matches }: { matches: NonNullable<ReturnType<typeof matchListings>>[] }) {
  const { state, propose } = useDemo();
  const run = useRun();
  const busy = (id?: string) => !!id && state.trades.some(t => ['Proposed', 'Pending FAA approval', 'Executed'].includes(t.status) && t.seriesIds.includes(id));
  if (!matches.length) return <Panel title="Matches"><Empty icon={ArrowRightLeft} title="No matches yet" body="Matches appear when another airline's open listing has the same direction and term, a time inside the wanted window, and overlapping days." /></Panel>;
  return (
    <div className="space-y-2">
      {matches.map(m => {
        const proposed = state.trades.find(t => t.listingIds.includes(m.a.id) && t.listingIds.includes(m.b.id) && t.status !== 'Declined' && t.status !== 'Rejected');
        return (
          <article key={m.a.id + m.b.id} className="rise grid gap-3 rounded-md border bg-card p-3 md:grid-cols-[64px_1fr_1fr_auto] md:items-center" data-testid={`card-match-${m.a.id}-${m.b.id}`}>
            <div className="flex items-baseline gap-1 md:flex-col md:items-start">
              <span className="tnum font-mono text-2xl font-semibold text-primary">{m.score}</span><span className="text-[10px] uppercase tracking-wider text-muted-foreground">score</span>
            </div>
            <div className="min-w-0 space-y-1"><div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Yours · {m.a.id} · {typeLabel(m.a.type)}</div>
              <SlotCode s={m.a.seriesId ? seriesById.get(m.a.seriesId) : undefined} />{m.a.wanted && <div className="text-xs">Wants <Wanted l={m.a} /></div>}</div>
            <div className="min-w-0 space-y-1"><div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground"><AirlineTag code={m.b.airline} /> · {m.b.id} · {typeLabel(m.b.type)}</div>
              <SlotCode s={m.b.seriesId ? seriesById.get(m.b.seriesId) : undefined} />{m.b.wanted && <div className="text-xs">Wants <Wanted l={m.b} /></div>}</div>
            <div className="flex flex-col items-start gap-1 md:items-end">
              {proposed ? <TradeChip status={proposed.status} /> :
                <Btn variant="primary" data-testid={`button-propose-${m.a.id}-${m.b.id}`} disabled={busy(m.a.seriesId) || busy(m.b.seriesId)}
                  onClick={() => run(() => propose(m.a.id, m.b.id), `Trade proposed to ${m.b.airline}`)}><Handshake className="h-3.5 w-3.5" />Propose</Btn>}
              <span className="text-[11px] text-muted-foreground">{m.a.term}{(m.a.priceUsd ?? m.b.priceUsd) !== undefined && ` · ${usd(m.a.priceUsd ?? m.b.priceUsd)}`}</span>
            </div>
            <p className="text-xs text-muted-foreground md:col-span-4 md:col-start-2">{m.reason}</p>
          </article>
        );
      })}
    </div>
  );
}

export function TradeSeries({ t }: { t: Trade }) {
  const { state } = useDemo();
  return (
    <div className="space-y-1.5">{t.seriesIds.map(id => {
      const s = seriesById.get(id)!, m = metrics(s, occBySeries.get(id) ?? [], state.date, state.trades);
      return <div key={id} className="flex flex-wrap items-center gap-2"><SlotCode s={s} /><StatusChip status={m.status} /><span className="tnum font-mono text-[11px] text-muted-foreground">{m.used}/{m.past} · proj {pct(m.projected)} · holder {seriesAt(s, state.date, state.trades).holder}</span></div>;
    })}</div>
  );
}

function Trades({ trades }: { trades: Trade[] }) {
  const { state, transition } = useDemo();
  const run = useRun();
  if (!trades.length) return <Panel title="Trades"><Empty icon={Handshake} title="No trades yet" body="Propose a trade from Matches. The counterparty accepts, then the FAA approves." /></Panel>;
  return (
    <Panel title={`Trades · ${trades.length}`}>
      <div className="overflow-x-auto"><table className="tnum w-full min-w-[920px] text-xs">
        <thead><tr>{['ID', 'Type', 'From → To', 'Series', 'Term / price', 'Status', 'Updated', ''].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{[...trades].reverse().map(t => {
          const cp = t.initiator === t.fromAirline ? t.toAirline : t.fromAirline;
          const ts = t.timestamps;
          return (
            <tr key={t.id} className="border-t align-top" data-testid={`row-trade-${t.id}`}>
              <td className={cn(td, 'font-mono')}>{t.id}</td><td className={td}>{typeLabel(t.type)}</td>
              <td className={td}><div className="space-y-1"><AirlineTag code={t.fromAirline} /><AirlineTag code={t.toAirline} /></div></td>
              <td className={td}><TradeSeries t={t} /></td>
              <td className={td}>{t.term}<div className="font-mono text-muted-foreground">{usd(t.priceUsd)}</div>{t.effectiveDate && <div className="text-muted-foreground">Effective {t.effectiveDate}</div>}</td>
              <td className={td}><TradeChip status={t.status} /></td>
              <td className={cn(td, 'font-mono text-muted-foreground')}>{fmtStamp(ts.approved ?? ts.rejected ?? ts.declined ?? ts.accepted ?? ts.proposed)}</td>
              <td className={td}>{t.status === 'Proposed' && state.role === cp ? (
                <div className="flex gap-1.5">
                  <Btn variant="primary" data-testid={`button-accept-${t.id}`} onClick={() => run(() => transition(t.id, 'Accept'), 'Accepted. Sent to FAA for approval')}>Accept</Btn>
                  <Btn variant="danger" data-testid={`button-decline-${t.id}`} onClick={() => run(() => transition(t.id, 'Decline'), 'Trade declined')}>Decline</Btn>
                </div>) : t.status === 'Proposed' ? <span className="text-muted-foreground">Awaiting {cp}</span> : t.status === 'Pending FAA approval' ? <span className="text-muted-foreground">Awaiting FAA</span> : null}</td>
            </tr>);
        })}</tbody>
      </table></div>
    </Panel>
  );
}

function CreateListing({ prefill, onClose }: { prefill: Prefill | null; onClose: (done: boolean) => void }) {
  const { state, createListing } = useDemo();
  const run = useRun();
  const mySeries = useMemo(() => seed.series.filter(s => available(s, state, seed) && !state.listings.some(l => l.seriesId === s.id && l.status !== 'closed')).sort((a, b) => a.time.localeCompare(b.time)), [state]);
  const pre = prefill ? seriesById.get(prefill.seriesId) : undefined;
  const [type, setType] = useState<Listing['type']>(prefill?.type ?? 'lease_out');
  const [seriesId, setSeriesId] = useState(prefill?.seriesId ?? mySeries[0]?.id ?? '');
  const [dir, setDir] = useState<'A' | 'D'>(pre?.direction ?? 'D');
  const [from, setFrom] = useState('07:00');
  const [to, setTo] = useState('08:00');
  const [days, setDays] = useState(pre?.daysMask ?? '1111111');
  const [term, setTerm] = useState<Term>('Rest of season');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const needSeries = type !== 'lease_in', needWanted = type !== 'lease_out';
  const options = pre && !mySeries.includes(pre) ? [pre, ...mySeries] : mySeries;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => createListing({
      type, term, notes: notes.trim() || undefined,
      seriesId: needSeries ? seriesId : undefined,
      wanted: needWanted ? { direction: dir, timeFrom: from, timeTo: to, daysMask: days } : undefined,
      priceUsd: type !== 'swap' && price !== '' ? Number(price) : undefined,
    }), 'Listing posted. Checking matches');
    if (ok) onClose(true);
  };
  const lbl = 'text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground';
  return (
    <Dialog open onOpenChange={o => !o && onClose(false)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{state.role === 'DL' ? 'Offer a Delta slot' : 'New listing'}</DialogTitle><DialogDescription>Posted as {state.role}. Offer a lease or swap, or request a lease-in. Matches update immediately.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4 text-xs">
          <fieldset><legend className={lbl}>Type</legend>
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-md border p-0.5">{(['swap', 'lease_out', 'lease_in'] as const).map(t => (
              <button type="button" key={t} aria-pressed={type === t} data-testid={`button-type-${t}`} onClick={() => setType(t)} className={cn('rounded px-2 py-1.5 font-semibold transition-colors', type === t ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>{t === 'lease_in' ? 'Lease in (wanted)' : typeLabel(t)}</button>))}</div>
          </fieldset>
          {needSeries && <label className="block space-y-1"><span className={lbl}>Your series</span>
            <select data-testid="select-series" className={cn(fieldCls, 'w-full')} value={seriesId} onChange={e => setSeriesId(e.target.value)} required>
              {!options.length && <option value="">No available series</option>}
              {options.map(s => <option key={s.id} value={s.id}>{s.id} · {decode(s)}</option>)}
            </select>
            {seriesById.get(seriesId) && <span className="block text-muted-foreground">{decode(seriesById.get(seriesId)!)}, flight {seriesById.get(seriesId)!.flightNumber}</span>}
          </label>}
          {needWanted && <fieldset className="space-y-2 rounded-md border p-3"><legend className={cn(lbl, 'px-1')}>Wanted</legend>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Wanted direction" className={fieldCls} value={dir} onChange={e => setDir(e.target.value as 'A' | 'D')}><option value="D">Departure</option><option value="A">Arrival</option></select>
              <input aria-label="From" type="time" className={fieldCls} value={from} onChange={e => setFrom(e.target.value)} required /> to
              <input aria-label="To" type="time" className={fieldCls} value={to} onChange={e => setTo(e.target.value)} required />
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Days of week">{DAYS.map((d, i) => (
              <button type="button" key={d} aria-pressed={days[i] === '1'} onClick={() => setDays(days.slice(0, i) + (days[i] === '1' ? '0' : '1') + days.slice(i + 1))}
                className={cn('h-7 w-10 rounded border font-semibold transition-colors', days[i] === '1' ? 'border-primary bg-accent text-accent-foreground' : 'text-muted-foreground hover:border-primary/40')}>{d}</button>))}
              <span className="self-center pl-1 text-muted-foreground">{days.includes('1') ? daysLabel(days) : 'Pick at least one day'}</span></div>
          </fieldset>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1"><span className={lbl}>Term</span>
              <select className={cn(fieldCls, 'w-full')} value={term} onChange={e => setTerm(e.target.value as Term)}><option>Rest of season</option><option>Rest of season plus Winter 2027/28</option></select></label>
            <label className="block space-y-1"><span className={lbl}>Price USD {type === 'swap' && '(leases only)'}</span>
              <input data-testid="input-price" type="number" min={0} step={0.01} inputMode="decimal" disabled={type === 'swap'} placeholder="Optional" className={cn(fieldCls, 'tnum w-full font-mono')} value={type === 'swap' ? '' : price} onChange={e => setPrice(e.target.value)} /></label>
          </div>
          {term !== 'Rest of season' && <p className="text-muted-foreground">Winter 2027/28 is recorded as demo metadata only. No next-season operations or utilization are simulated.</p>}
          <label className="block space-y-1"><span className={lbl}>Notes</span>
            <textarea data-testid="input-notes" rows={2} className={cn(fieldCls, 'h-auto w-full py-1.5')} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Context for counterparties" /></label>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Btn type="button" onClick={() => onClose(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" data-testid="button-submit-listing" disabled={needSeries && !seriesId}>{state.role === 'DL' && type !== 'lease_in' ? 'Offer slot' : 'Post listing'}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
