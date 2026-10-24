import type { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Eye, FileSignature, ShieldCheck, XCircle, Clock, Ban, CircleCheckBig, CircleSlash } from 'lucide-react';
import type { Status, TradeStatus, SlotSeries, Occurrence, Trade, AirlineCode } from '@/domain/types';
import { seed } from '@/domain/seed';
import { decode } from '@/domain/rules';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const STATUS_META: Record<Status, { icon: typeof Eye; v: string }> = {
  Lost: { icon: XCircle, v: '--st-lost' },
  Critical: { icon: AlertOctagon, v: '--st-critical' },
  'At risk': { icon: AlertTriangle, v: '--st-risk' },
  Watch: { icon: Eye, v: '--st-watch' },
  'On track': { icon: CheckCircle2, v: '--st-ok' },
  'Covered by lease': { icon: FileSignature, v: '--st-lease' },
  Secured: { icon: ShieldCheck, v: '--st-secured' },
};

export function StatusChip({ status, className }: { status: Status; className?: string }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span
      data-testid={`status-${status.replace(/\s/g, '-').toLowerCase()}`}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold leading-none', className)}
      style={{ color: `hsl(var(${m.v}))`, borderColor: `hsl(var(${m.v}) / .35)`, background: `hsl(var(${m.v}) / .08)` }}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {status}
    </span>
  );
}

const TRADE_META: Record<TradeStatus, { icon: typeof Eye; v: string }> = {
  Proposed: { icon: Clock, v: '--st-watch' },
  'Pending FAA approval': { icon: ShieldCheck, v: '--st-lease' },
  Executed: { icon: CircleCheckBig, v: '--st-ok' },
  Declined: { icon: CircleSlash, v: '--st-lost' },
  Rejected: { icon: Ban, v: '--st-critical' },
};
export function TradeChip({ status }: { status: TradeStatus }) {
  const m = TRADE_META[status];
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold leading-none"
      style={{ color: `hsl(var(${m.v}))`, borderColor: `hsl(var(${m.v}) / .35)`, background: `hsl(var(${m.v}) / .08)` }}>
      <Icon className="h-3 w-3" aria-hidden />{status}
    </span>
  );
}

export const airlineName = (c: string) => c === 'FAA' ? 'FAA' : seed.airlines.find(a => a.code === c)?.name ?? c;
export function AirlineTag({ code }: { code: string }) {
  const color = seed.airlines.find(a => a.code === code)?.color;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="h-2 w-2 rounded-[2px]" style={{ background: color ?? 'hsl(var(--foreground))' }} aria-hidden />
      <span className="font-mono text-[11px] font-semibold">{code}</span>
      <span className="text-muted-foreground">{airlineName(code)}</span>
    </span>
  );
}

export const seriesById = new Map(seed.series.map(s => [s.id, s]));
export const occBySeries = (() => {
  const m = new Map<string, Occurrence[]>();
  for (const o of seed.occurrences) { const a = m.get(o.seriesId); if (a) a.push(o); else m.set(o.seriesId, [o]); }
  return m;
})();

export function SlotCode({ s, compact }: { s?: SlotSeries; compact?: boolean }) {
  if (!s) return <span className="text-muted-foreground">Wanted request</span>;
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="font-mono text-[11px] tracking-tight">{s.id}</span>
      {!compact && <span className="text-xs text-muted-foreground">{decode(s)}</span>}
    </span>
  );
}

export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
export const usd = (n?: number) => n === undefined ? '—' : `$${n.toLocaleString('en-US')}`;
export const fmtDate = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${day}, ${y}`;
};
export const fmtStamp = (ts: string) => ts.length > 10 ? `${ts.slice(0, 10)} ${ts.slice(11, 19)}` : ts;
export const typeLabel = (t: string) => ({ swap: 'Swap', lease_out: 'Lease out', lease_in: 'Lease in', lease: 'Lease' } as Record<string, string>)[t] ?? t;
export const tradeParties = (t: Trade): AirlineCode[] => [t.fromAirline, t.toAirline];

export function useRun() {
  const { toast } = useToast();
  return async (fn: () => unknown, ok: string) => {
    try { await fn(); toast({ title: ok }); return true; }
    catch (e) { toast({ title: 'Action blocked', description: e instanceof Error ? e.message : String(e), variant: 'destructive' }); return false; }
  };
}

export function Btn({ children, variant = 'outline', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' }) {
  return (
    <button
      {...p}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-[transform,background-color,border-color] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'outline' && 'border border-input bg-card hover:border-primary/50 hover:bg-accent/60',
        variant === 'ghost' && 'hover:bg-accent/70',
        variant === 'danger' && 'border border-destructive/40 bg-card text-destructive hover:bg-destructive/5',
        className)}
    >{children}</button>
  );
}

export const fieldCls = 'h-8 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function Panel({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-md border bg-card', className)}>
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ icon: Icon, title, body }: { icon: typeof Eye; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-primary/40 text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

export const th = 'whitespace-nowrap px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground';
export const td = 'px-3 py-2 align-middle';
