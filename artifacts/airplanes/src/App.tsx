import { useState } from 'react';
import { RotateCcw, Plane, AlertTriangle } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { useDemo } from '@/domain/store';
import { dayNumber, START, END } from '@/domain/rules';
import type { Actor } from '@/domain/types';
import { Utilization, type Prefill } from '@/components/utilization';
import { Marketplace } from '@/components/marketplace';
import { Approvals, AuditLog } from '@/components/regulator';
import { airlineName, Btn, fieldCls, useRun } from '@/components/kit';
import { cn } from '@/lib/utils';

type Tab = 'utilization' | 'marketplace' | 'audit' | 'approvals';
const ROLES: Actor[] = ['B6', 'DL', 'AA', 'BA', 'AS', 'LH', 'FAA'];

function Shell() {
  const { state, setRole, setDate, reset, persistenceError } = useDemo();
  const run = useRun();
  const [tab, setTab] = useState<Tab>(() => state.role === 'DL' ? 'marketplace' : 'utilization');
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const isFAA = state.role === 'FAA';
  const pending = state.trades.filter(t => t.status === 'Pending FAA approval').length;
  const tabs: [Tab, string][] = [['utilization', 'Utilization'], ['marketplace', 'Marketplace'], ['audit', 'Audit log'], ...(isFAA ? [['approvals', 'Approvals']] as [Tab, string][] : [])];
  const active = !isFAA && tab === 'approvals' ? 'utilization' : tab;
  const day = dayNumber(state.date);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground"><Plane className="h-4 w-4 -rotate-45" aria-hidden /></span>
            <div className="leading-tight"><div className="text-sm font-bold tracking-tight">AIrplanes</div>
              <div className="text-[11px] text-muted-foreground"><span className="font-mono font-semibold text-foreground">JFK</span> · Winter 2026/27 (Oct 25, 2026 to Mar 27, 2027)</div></div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">Snapshot
              <input type="date" data-testid="input-date" min={START} max={END} value={state.date} className={cn(fieldCls, 'tnum font-mono')}
                onChange={e => e.target.value >= START && e.target.value <= END && setDate(e.target.value)} />
            </label>
            <span className="tnum hidden h-8 items-center gap-2 rounded-md border bg-background px-2 font-mono text-[11px] sm:flex" data-testid="text-day">
              Day {day} of 154
              <span className="relative h-1 w-14 rounded-full bg-muted" aria-hidden><span className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(day / 154) * 100}%` }} /></span>
            </span>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">Acting as
              <select data-testid="select-role" className={cn(fieldCls, 'font-semibold text-foreground')} value={state.role} onChange={e => setRole(e.target.value as Actor)}>
                {ROLES.map(r => <option key={r} value={r}>{r} · {airlineName(r)}</option>)}
              </select>
            </label>
            <Btn data-testid="button-reset" onClick={() => { if (confirm('Reset demo? This removes all local listings, trades and audit events and restores the original seed.')) run(() => { reset(); setPrefill(null); setTab('utilization'); }, 'Demo reset to seeded state'); }}><RotateCcw className="h-3.5 w-3.5" />Reset demo</Btn>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4" aria-label="Sections">
          {tabs.map(([k, l]) => (
            <button key={k} data-testid={`nav-${k}`} aria-current={active === k ? 'page' : undefined} onClick={() => setTab(k)}
              className={cn('relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-semibold transition-colors', active === k ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
              {l}{k === 'approvals' && pending > 0 && <span className="tnum rounded-sm bg-primary px-1 font-mono text-[10px] text-primary-foreground">{pending}</span>}
              <span className={cn('absolute inset-x-2 -bottom-px h-0.5 origin-left rounded-full bg-primary transition-transform duration-200', active === k ? 'scale-x-100' : 'scale-x-0')} />
            </button>
          ))}
        </nav>
      </header>
      {persistenceError && <div role="alert" className="flex items-center gap-2 border-b bg-[hsl(var(--st-watch)/.1)] px-4 py-1.5 text-xs"><AlertTriangle className="h-3.5 w-3.5" />{persistenceError}</div>}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4">
        <ErrorBoundary resetKey={active + state.role}>
          {active === 'utilization' && <Utilization onPrefill={p => { setPrefill(p); setTab('marketplace'); }} />}
          {active === 'marketplace' && <Marketplace prefill={prefill} clearPrefill={() => setPrefill(null)} />}
          {active === 'audit' && <AuditLog />}
          {active === 'approvals' && <Approvals />}
        </ErrorBoundary>
      </main>
      <footer className="border-t px-4 py-3 text-center text-[11px] text-muted-foreground">Simulated data for demonstration. Not real airline schedules.</footer>
    </div>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Shell />
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
