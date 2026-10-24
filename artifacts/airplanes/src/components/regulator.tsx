import { useState } from 'react';
import { ShieldCheck, ScrollText } from 'lucide-react';
import { useDemo } from '@/domain/store';
import { AirlineTag, Btn, Empty, Panel, TradeChip, fieldCls, fmtStamp, td, th, typeLabel, usd, useRun } from './kit';
import { TradeSeries } from './marketplace';
import { cn } from '@/lib/utils';

export function Approvals() {
  const { state, transition } = useDemo();
  const run = useRun();
  const pending = state.trades.filter(t => t.status === 'Pending FAA approval');
  const decided = state.trades.filter(t => t.status === 'Executed' || t.status === 'Rejected');
  return (
    <div className="space-y-4">
      <Panel title={`Approvals queue · ${pending.length} pending`}>
        {!pending.length ? <Empty icon={ShieldCheck} title="Queue is clear" body="Trades appear here after the counterparty accepts. Nothing changes until the FAA approves." /> :
          <div className="divide-y">{pending.map(t => (
            <article key={t.id} className="rise grid gap-3 p-3 lg:grid-cols-[180px_1fr_auto] lg:items-start" data-testid={`card-approval-${t.id}`}>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2"><span className="font-mono font-semibold">{t.id}</span><TradeChip status={t.status} /></div>
                <div>{typeLabel(t.type)} · {t.term}</div><div className="tnum font-mono text-muted-foreground">{usd(t.priceUsd)}</div>
                <AirlineTag code={t.fromAirline} /><div className="text-muted-foreground">to</div><AirlineTag code={t.toAirline} />
              </div>
              <div className="min-w-0 text-xs"><div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Series utilization at {state.date}</div><TradeSeries t={t} />
                <p className="mt-2 text-muted-foreground">If approved, effective the day after the snapshot date. {t.type === 'lease' ? 'Holder keeps ownership; lessee operates remaining occurrences.' : 'Series exchange holders.'}</p></div>
              <div className="flex gap-1.5">
                <Btn variant="primary" data-testid={`button-approve-${t.id}`} onClick={() => run(() => transition(t.id, 'Approve'), `${t.id} approved and executed`)}>Approve</Btn>
                <Btn variant="danger" data-testid={`button-reject-${t.id}`} onClick={() => run(() => transition(t.id, 'Reject'), `${t.id} rejected`)}>Reject</Btn>
              </div>
            </article>))}</div>}
      </Panel>
      {!!decided.length && <Panel title="Decided">
        <div className="overflow-x-auto"><table className="tnum w-full min-w-[640px] text-xs"><thead><tr>{['ID', 'Type', 'Parties', 'Status', 'Effective', 'Decided'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{decided.map(t => <tr key={t.id} className="border-t"><td className={cn(td, 'font-mono')}>{t.id}</td><td className={td}>{typeLabel(t.type)}</td><td className={cn(td, 'font-mono')}>{t.fromAirline} → {t.toAirline}</td><td className={td}><TradeChip status={t.status} /></td><td className={cn(td, 'font-mono')}>{t.effectiveDate ?? '—'}</td><td className={cn(td, 'font-mono text-muted-foreground')}>{fmtStamp(t.timestamps.approved ?? t.timestamps.rejected ?? '')}</td></tr>)}</tbody></table></div>
      </Panel>}
    </div>
  );
}

export function AuditLog() {
  const { state } = useDemo();
  const [q, setQ] = useState('');
  const rows = state.audit.filter(e => state.role === 'FAA' || e.actor === state.role || e.parties.includes(state.role as never))
    .filter(e => !q || `${e.action} ${e.objectId} ${e.details} ${e.actor}`.toLowerCase().includes(q.toLowerCase())).slice().reverse();
  return (
    <Panel title={`Audit log · ${state.role === 'FAA' ? 'all events' : `${state.role} events`} · ${rows.length}`} right={<input aria-label="Filter audit log" placeholder="Filter" className={cn(fieldCls, 'w-44')} value={q} onChange={e => setQ(e.target.value)} />}>
      {!rows.length ? <Empty icon={ScrollText} title="No events yet" body="Every listing, proposal, acceptance and approval is appended here. Append only." /> :
        <div className="overflow-x-auto"><table className="tnum w-full min-w-[720px] text-xs">
          <thead><tr>{['Timestamp', 'Actor', 'Action', 'Object', 'Details'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(e => <tr key={e.id} className="border-t hover:bg-accent/40" data-testid={`row-audit-${e.id}`}>
            <td className={cn(td, 'whitespace-nowrap font-mono text-muted-foreground')}>{fmtStamp(e.timestamp)}</td>
            <td className={td}><AirlineTag code={e.actor} /></td><td className={cn(td, 'font-semibold')}>{e.action}</td>
            <td className={cn(td, 'font-mono')}>{e.objectId}</td><td className={td}>{e.details}</td></tr>)}</tbody>
        </table></div>}
    </Panel>
  );
}
