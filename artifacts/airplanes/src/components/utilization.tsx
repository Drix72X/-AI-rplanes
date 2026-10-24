import { useMemo, useState } from 'react';
import { Search, ArrowRightLeft, FileSignature, Building2, Plane } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useDemo } from '@/domain/store';
import { seed } from '@/domain/seed';
import { metrics, seriesAt, decode, daysLabel, severity, START, addDays } from '@/domain/rules';
import type { SlotSeries, Status, Occurrence } from '@/domain/types';
import { StatusChip, STATUS_META, occBySeries, pct, fmtDate, airlineName, Btn, fieldCls, Panel, Empty, th, td } from './kit';
import { cn } from '@/lib/utils';

type M = ReturnType<typeof metrics>;
export type Row = { s: SlotSeries; m: M };

export function useRows(): Row[] {
  const { state } = useDemo();
  return useMemo(() => {
    if (state.role === 'FAA') return [];
    return seed.series
      .map(s => ({ s: seriesAt(s, state.date, state.trades), raw: s }))
      .filter(x => x.s.holder === state.role)
      .map(({ s, raw }) => ({ s, m: metrics(raw, occBySeries.get(raw.id) ?? [], state.date, state.trades) }))
      .sort((a, b) => severity.indexOf(a.m.status) - severity.indexOf(b.m.status) || a.m.projected - b.m.projected);
  }, [state.role, state.date, state.trades]);
}

export type Prefill = { type: 'lease_out' | 'swap'; seriesId: string };

export function Utilization({ onPrefill }: { onPrefill: (p: Prefill) => void }) {
  const { state } = useDemo();
  const rows = useRows();
  const [open, setOpen] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState<'all' | Status>('all');
  const [fDir, setFDir] = useState<'all' | 'A' | 'D'>('all');
  const [from, setFrom] = useState('00:00');
  const [to, setTo] = useState('23:59');
  const [q, setQ] = useState('');

  if (state.role === 'FAA') return (
    <Panel><Empty icon={Building2} title="The FAA holds no slot series" body="As regulator, review pending trades under Approvals and every recorded event in the Audit log. Switch to an airline to see its portfolio." /></Panel>
  );

  const filtered = rows.filter(r => (fStatus === 'all' || r.m.status === fStatus) && (fDir === 'all' || r.s.direction === fDir) && r.s.time >= from && r.s.time <= to &&
    (!q || r.s.id.toLowerCase().includes(q.toLowerCase()) || r.s.flightNumber.toLowerCase().replace(/\s/g, '').includes(q.toLowerCase().replace(/\s/g, ''))));
  const sum = rows.reduce((a, r) => ({ u: a.u + r.m.used, p: a.p + r.m.past }), { u: 0, p: 0 });
  const count = (...st: Status[]) => rows.filter(r => st.includes(r.m.status)).length;
  const cards: [string, string, string?, string?][] = [
    ['Series held', String(rows.length), `${rows.filter(r => r.s.operator !== r.s.holder).length} leased to others`],
    ['Utilization to date', sum.p ? pct(sum.u / sum.p) : '—', `Portfolio aggregate · not series compliance`],
    ['Critical + At risk', String(count('Critical', 'At risk')), `${count('Critical')} critical · ${count('At risk')} at risk`, '--st-critical'],
    ['Watch', String(count('Watch')), 'Projected 80–85%', '--st-watch'],
    ['Lost', String(count('Lost')), 'Cannot reach 80%', '--st-lost'],
    ['Secured', String(count('Secured')), 'Already past 80%', '--st-secured'],
  ];
  const sel = rows.find(r => r.s.id === open);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([k, v, sub, c], i) => (
          <div key={k} className="rise bg-card px-3 py-3" style={{ animationDelay: `${i * 30}ms` }} data-testid={`card-${k.replace(/\W+/g, '-').toLowerCase()}`}>
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              {c && <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(var(${c}))` }} aria-hidden />}{k}
            </div>
            <div className="tnum mt-1 font-mono text-2xl font-semibold tracking-tight">{v}</div>
            <div className="tnum truncate text-[11px] text-muted-foreground">{sub}</div>
          </div>
        ))}
      </div>

      <Panel title={`Series · ${filtered.length} of ${rows.length}`} right={
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search by code or flight</span>
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
            <input data-testid="input-search" className={cn(fieldCls, 'w-48 pl-7')} placeholder="Code or flight" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <select aria-label="Status filter" data-testid="select-status" className={fieldCls} value={fStatus} onChange={e => setFStatus(e.target.value as Status | 'all')}>
            <option value="all">All statuses</option>{severity.map(s => <option key={s}>{s}</option>)}
          </select>
          <select aria-label="Direction filter" data-testid="select-direction" className={fieldCls} value={fDir} onChange={e => setFDir(e.target.value as 'all')}>
            <option value="all">Arr + Dep</option><option value="A">Arrivals</option><option value="D">Departures</option>
          </select>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <input aria-label="Time from" type="time" className={fieldCls} value={from} onChange={e => setFrom(e.target.value || '00:00')} />–
            <input aria-label="Time to" type="time" className={fieldCls} value={to} onChange={e => setTo(e.target.value || '23:59')} />
          </span>
        </div>
      }>
        <div className="max-h-[480px] overflow-auto">
          <table className="tnum w-full min-w-[980px] text-xs">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]"><tr>
              {['Slot code', 'Decode', 'Flight', 'Used / past', 'To date', 'Projected', 'Need', 'Status', 'Prior season'].map(h => <th key={h} className={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.s.id} tabIndex={0} data-testid={`row-series-${r.s.id}`} onClick={() => setOpen(r.s.id)} onKeyDown={e => e.key === 'Enter' && setOpen(r.s.id)}
                  className="cursor-pointer border-t transition-colors hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none">
                  <td className={cn(td, 'font-mono text-[11px]')}>{r.s.id}</td>
                  <td className={td}>{decode(r.s)}</td>
                  <td className={cn(td, 'font-mono')}>{r.s.flightNumber}{r.s.operator !== r.s.holder && <span className="ml-1 text-muted-foreground">op {r.s.operator}</span>}</td>
                  <td className={cn(td, 'font-mono')}>{r.m.used} / {r.m.past}</td>
                  <td className={cn(td, 'font-mono')}>{r.m.past ? pct(r.m.used / r.m.past) : '—'}</td>
                  <td className={cn(td, 'font-mono')}><Bar v={r.m.projected} /></td>
                  <td className={cn(td, 'whitespace-nowrap')}>{r.m.shortfall <= 0 ? <span className="text-muted-foreground">Met</span> : r.m.covered ? <span className="text-muted-foreground">Lessee flies {r.m.remaining}</span> : `${r.m.shortfall} of ${r.m.remaining} remaining`}</td>
                  <td className={td}><StatusChip status={r.m.status} /></td>
                  <td className={cn(td, 'font-mono')}>{pct(r.s.priorSeasonUtilization, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty icon={Search} title="No series match" body="Loosen the status, direction or time filters, or clear the search." />}
        </div>
      </Panel>

      <Heatmap rows={filtered} date={state.date} onOpen={setOpen} />

      <Sheet open={!!sel} onOpenChange={o => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {sel && <Detail row={sel} date={state.date} onPrefill={p => { setOpen(null); onPrefill(p); }} canTrade={!sel.m.covered && sel.m.remaining > 0 && !state.trades.some(t => t.status === 'Executed' && t.seriesIds.includes(sel.s.id))} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Bar({ v }: { v: number }) {
  const c = v >= .85 ? '--st-ok' : v >= .8 ? '--st-watch' : '--st-critical';
  return (
    <span className="flex items-center gap-2">
      <span className="w-12 text-right">{pct(v)}</span>
      <span className="relative h-1.5 w-16 rounded-full bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, v * 100)}%`, background: `hsl(var(${c}))` }} />
        <span className="absolute -top-0.5 h-2.5 w-px bg-foreground/60" style={{ left: '80%' }} />
      </span>
    </span>
  );
}

function Heatmap({ rows, date, onOpen }: { rows: Row[]; date: string; onOpen: (id: string) => void }) {
  const snapWeek = Math.floor((Date.parse(date) - Date.parse(START)) / (7 * 864e5));
  const cell = (occ: Occurrence[], w: number) => {
    const ws = addDays(START, w * 7), we = addDays(START, w * 7 + 6);
    const wk = occ.filter(o => o.date >= ws && o.date <= we && o.date <= date);
    if (!wk.length) return { c: 'hsl(var(--muted))', t: 'Future week' };
    const u = wk.filter(o => o.outcome === 'operated' || o.outcome === 'justified').length / wk.length;
    return { c: u >= .8 ? 'hsl(var(--st-ok))' : u >= .5 ? 'hsl(var(--st-watch))' : 'hsl(var(--st-critical))', t: `${pct(u, 0)} used (${wk.length} occ.)` };
  };
  return (
    <Panel title="Season heatmap · weekly utilization" right={
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {[['--st-ok', '80%+'], ['--st-watch', '50–79%'], ['--st-critical', 'Under 50%'], ['--muted', 'Future']].map(([v, l]) => (
          <span key={l} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] border" style={{ background: `hsl(var(${v}))` }} />{l}</span>
        ))}
      </div>}>
      <div className="max-h-[420px] overflow-auto p-3">
        <div className="min-w-[760px]">
          <div className="mb-1 grid items-end gap-px text-[10px] text-muted-foreground" style={{ gridTemplateColumns: '220px repeat(22,minmax(0,1fr))' }}>
            <span>Series</span>
            {Array.from({ length: 22 }, (_, w) => <span key={w} className={cn('tnum text-center font-mono', w === snapWeek && 'font-bold text-primary')}>{w + 1}</span>)}
          </div>
          {rows.map(r => (
            <button key={r.s.id} data-testid={`heat-row-${r.s.id}`} onClick={() => onOpen(r.s.id)} aria-label={`Open ${r.s.id}, ${decode(r.s)}`}
              className="group grid w-full items-center gap-px rounded-sm py-[1px] text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ gridTemplateColumns: '220px repeat(22,minmax(0,1fr))' }}>
              <span className="truncate pr-2 font-mono text-[10.5px] group-hover:text-primary">{r.s.time} {r.s.direction} · {r.s.id.slice(-4)} · {daysLabel(r.s.daysMask).slice(0, 10)}</span>
              {Array.from({ length: 22 }, (_, w) => {
                const c = cell(r.m.occurrences, w);
                return <span key={w} title={`Week ${w + 1}: ${c.t}`} className={cn('h-3.5', w === snapWeek && 'outline outline-2 -outline-offset-1 outline-foreground/70')} style={{ background: c.c }} />;
              })}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

const OUT: Record<Occurrence['outcome'], string> = { operated: 'hsl(var(--st-ok))', cancelled: 'hsl(var(--st-critical))', justified: 'hsl(var(--st-lease))', scheduled: 'hsl(var(--muted))' };

function sentence(r: Row, date: string) {
  const { s, m } = r, who = airlineName(s.holder), last = m.occurrences[m.occurrences.length - 1]?.date;
  const unit = s.daysMask === '1111111' ? 'occurrence' : daysLabel(s.daysMask).replace(/s$/, '').replace(/s,/g, ',');
  switch (m.status) {
    case 'Critical': return `Critical: ${who} must operate every remaining ${unit} through ${fmtDate(last)} or this series falls below 80%.`;
    case 'Lost': return `Lost: even if all ${m.remaining} remaining occurrences fly, the best case is ${m.bestCase} against ${m.required} required. The series reverts next season.`;
    case 'At risk': return `At risk: at the current ${pct(m.rate)} pace the season ends at ${pct(m.projected)}. ${who} needs ${m.shortfall} of the ${m.remaining} remaining occurrences.`;
    case 'Watch': return `Watch: projected ${pct(m.projected)}, passing with little room. ${m.remaining - m.shortfall + 1} more cancellations would lose it.`;
    case 'On track': return `On track: projected ${pct(m.projected)} at the current pace as of ${fmtDate(date)}.`;
    case 'Covered by lease': return `Covered by lease: ${airlineName(m.occurrences.find(o => o.date > date)!.operatedBy)} has committed to fly all ${m.remaining} remaining occurrences, projecting ${Math.round(m.projectedUsed)} of ${m.total} (${pct(m.projected)}), against ${m.required} required.`;
    case 'Secured': return `Secured: ${m.used} used already meets the ${m.required} required for the season.`;
  }
}

function Detail({ row, date, onPrefill, canTrade }: { row: Row; date: string; onPrefill: (p: Prefill) => void; canTrade: boolean }) {
  const { s, m } = row;
  const [hover, setHover] = useState<Occurrence | null>(null);
  const lastPast = m.occurrences.filter(o => o.date <= date).slice(-1)[0]?.date;
  const chart = useMemo(() => {
    let used = 0, proj = 0;
    return m.occurrences.map(o => {
      const past = o.date <= date;
      if (past) { if (o.outcome === 'operated' || o.outcome === 'justified') used++; proj = used; }
      else proj += o.reason === 'Committed lease operation' || m.covered ? 1 : m.rate;
      return { date: o.date, actual: past ? (used / m.total) * 100 : null, projected: !past || o.date === lastPast ? (proj / m.total) * 100 : null };
    });
  }, [m, date, lastPast]);
  const big: [string, string][] = [
    ['Used so far', `${m.used} of ${m.past}`], ['Required', `${m.required} of ${m.total}`], ['Remaining', String(m.remaining)],
    ['Must operate', m.shortfall <= 0 ? 'None' : `${Math.min(m.shortfall, 999)} of ${m.remaining}`],
  ];
  return (
    <div className="space-y-5">
      <SheetHeader className="space-y-2 text-left">
        <div className="flex flex-wrap items-center gap-2"><StatusChip status={m.status} /><span className="font-mono text-[11px] text-muted-foreground">{s.id}</span></div>
        <SheetTitle className="text-lg leading-snug" data-testid="text-detail-title">{decode(s)}, {airlineName(s.holder)} {s.flightNumber}</SheetTitle>
        <SheetDescription className="text-sm text-foreground/80" data-testid="text-status-sentence">
          <span className="border-l-2 pl-2 block" style={{ borderColor: `hsl(var(${STATUS_META[m.status].v}))` }}>{sentence(row, date)}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
        {big.map(([k, v]) => (
          <div key={k} className="bg-card px-3 py-2.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{k}</div>
            <div className="tnum font-mono text-xl font-semibold" data-testid={`text-${k.replace(/\s/g, '-').toLowerCase()}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="tnum flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>Projected <b className="font-mono text-foreground">{pct(m.projected)}</b> ({m.projectedUsed.toFixed(1)} of {m.total})</span>
        <span>Best case <b className="font-mono text-foreground">{m.bestCase}</b> vs {m.required}</span>
        <span>Prior season <b className="font-mono text-foreground">{pct(s.priorSeasonUtilization, 0)}</b></span>
        {s.operator !== s.holder && <span>Operated by <b className="text-foreground">{airlineName(s.operator)}</b></span>}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"><span>Occurrences · {m.total}</span>
          <span className="flex gap-2 normal-case tracking-normal">{(['operated', 'cancelled', 'justified', 'scheduled'] as const).map(k => <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-[2px] border" style={{ background: OUT[k] }} />{k[0].toUpperCase() + k.slice(1)}</span>)}</span>
        </div>
        <div className="flex flex-wrap gap-[2px]" onMouseLeave={() => setHover(null)}>
          {m.occurrences.map((o, i) => {
            const marker = o.date <= date && (m.occurrences[i + 1]?.date ?? '9') > date;
            const label = `${fmtDate(o.date)}: ${o.outcome}${o.reason ? ` (${o.reason})` : ''}, ${o.operatedBy}`;
            return (
              <span key={o.date} className="relative">
                <button aria-label={label} title={label} onMouseEnter={() => setHover(o)} onFocus={() => setHover(o)}
                  className="block h-5 rounded-[2px] transition-transform hover:scale-y-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  style={{ background: OUT[o.outcome], width: m.total > 60 ? 6 : 14 }} />
                {marker && <span className="absolute -right-[2px] -top-1 h-7 w-[2px] bg-foreground" aria-hidden />}
              </span>
            );
          })}
        </div>
        <div className="tnum mt-1.5 h-4 font-mono text-[11px] text-muted-foreground" aria-live="polite">
          {hover ? `${fmtDate(hover.date)} · ${hover.outcome}${hover.reason ? ` · ${hover.reason}` : ''} · operated by ${hover.operatedBy}` : `Snapshot marker: ${fmtDate(date)}. Hover a cell for details.`}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Cumulative utilization of season total</div>
        <div className="h-56 rounded-md border p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => fmtDate(d).replace(/, \d+$/, '')} minTickGap={30} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <RTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} labelFormatter={d => fmtDate(String(d))} formatter={(v: number, n) => [`${v.toFixed(1)}%`, n === 'actual' ? 'Actual' : 'Projected']} />
              <ReferenceLine y={80} stroke="hsl(var(--st-critical))" strokeDasharray="2 2" label={{ value: '80% required', fontSize: 10, position: 'insideTopLeft', fill: 'hsl(var(--st-critical))' }} />
              <ReferenceLine x={lastPast} stroke="hsl(var(--foreground))" strokeOpacity={.4} />
              <Line dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="projected" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Btn variant="primary" data-testid="button-lease-out" disabled={!canTrade} onClick={() => onPrefill({ type: 'lease_out', seriesId: s.id })}><FileSignature className="h-3.5 w-3.5" />Lease out</Btn>
        <Btn data-testid="button-find-swap" disabled={!canTrade} onClick={() => onPrefill({ type: 'swap', seriesId: s.id })}><ArrowRightLeft className="h-3.5 w-3.5" />Find a swap</Btn>
        {!canTrade && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Plane className="h-3.5 w-3.5" />Already committed or no future occurrences.</span>}
      </div>
    </div>
  );
}
