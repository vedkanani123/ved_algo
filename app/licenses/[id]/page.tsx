import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConsoleNav, DangerAction, EditLicenseForm, EmptyState, LicenseKey, LicenseStatus } from '../../../components/console-ui';
import { requireOwner } from '../../../lib/auth';
import { getLicense } from '../../../lib/licenses';

function operatorTimestamp(value: string) {
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function auditLabel(action: string) {
  return action.replace(/^license\./, 'License ').replaceAll('.', ' ');
}

type HeartbeatRecord = { id: number | string; received_at: string; account_number: number | string; device_fingerprint: string; ea_version: string; telemetry: { balance?: number; equity?: number; freeMargin?: number; openPositions?: number; dealsToday?: number; symbol?: string; broker?: string } | null };
type AuditRecord = { id: number | string; created_at: string; actor_id: string | null; action: string };

export default async function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  let license;
  try {
    license = await getLicense(id);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST116') notFound();
    throw error;
  }
  const keyForResponse = license.licenseKey;
  return <div className="app-shell"><ConsoleNav active="licenses" /><main className="main"><header className="detail-header"><div><p className="eyebrow">License record / {id}</p><h1>{license.licenseKey.slice(0, 19)}</h1></div><div className="page-actions"><LicenseStatus status={license.status} /><a className="button button--amber" href={`/api/licenses/${id}/set`}>↓ Download .set</a></div></header>
    <section className="trust-strip" aria-label="Current authorization chain"><div className="trust-node"><span>01 / License</span><strong>{license.licenseKey.slice(0, 14)}</strong></div><i className="trust-link" /><div className="trust-node"><span>02 / Trading account</span><strong>{license.allowed_account ?? 'Awaiting first bind'}</strong></div><i className="trust-link" /><div className="trust-node"><span>03 / Terminal device</span><strong>{license.bound_device_fingerprint ?? 'Awaiting first bind'}</strong></div><i className="trust-link" /><div className="trust-node"><span>04 / Last heartbeat</span><strong>{license.last_seen_at ? new Date(license.last_seen_at).toLocaleString('en-IN') : 'No heartbeat received'}</strong></div></section>
    <div className="detail-grid"><div><section className="section"><header className="panel-header"><div><p className="eyebrow">Credential material</p><h2>License key</h2></div></header><div className="key-card"><LicenseKey value={keyForResponse} /></div></section>
      <section className="section"><header className="panel-header"><div><p className="eyebrow">Terminal telemetry</p><h2>Recent heartbeats</h2></div><span className="panel-link">Live payload</span></header>{license.heartbeats.length === 0 ? <EmptyState title="No terminal heartbeats">The first accepted EA handshake will appear here with the bound account, device, and trading telemetry.</EmptyState> : <div className="data-panel table-wrap"><table className="data-table"><thead><tr><th>Received</th><th>Account</th><th>Balance</th><th>Equity</th><th>Positions</th><th>Deals today</th><th>Build</th><th>Result</th></tr></thead><tbody>{license.heartbeats.map((heartbeat: HeartbeatRecord) => { const telemetry = heartbeat.telemetry ?? {}; return <tr key={heartbeat.id}><td className="mono">{operatorTimestamp(heartbeat.received_at)}</td><td className="mono">{heartbeat.account_number}</td><td className="mono">{telemetry.balance?.toFixed(2) ?? '—'}</td><td className="mono">{telemetry.equity?.toFixed(2) ?? '—'}</td><td className="mono">{telemetry.openPositions ?? '—'}</td><td className="mono">{telemetry.dealsToday ?? '—'}</td><td className="mono">{heartbeat.ea_version}</td><td><LicenseStatus status="active" /></td></tr>; })}</tbody></table></div>}</section>
      <section className="section"><header className="panel-header"><div><p className="eyebrow">Append-only ledger</p><h2>Immutable audit log</h2></div><span className="panel-link">Read only</span></header>{license.audit.length === 0 ? <EmptyState title="No audit records">Owner actions and terminal authorization events are recorded here permanently.</EmptyState> : <div className="data-panel table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Reference</th></tr></thead><tbody>{license.audit.map((record: AuditRecord) => <tr key={record.id}><td className="mono">{operatorTimestamp(record.created_at)}</td><td className="mono">{record.actor_id ? record.actor_id.slice(0, 12) : 'terminal'}</td><td>{auditLabel(record.action)}</td><td className="mono">AUD-{record.id}</td></tr>)}</tbody></table></div>}</section>
      <DangerAction licenseId={id} /></div>
      <aside><section className="section"><p className="eyebrow">Record state</p><dl className="metadata"><div><dt>Customer</dt><dd>{license.customer_label}</dd></div><div><dt>Trading account</dt><dd>{license.allowed_account}</dd></div><div><dt>Issued</dt><dd>{new Date(license.created_at).toLocaleDateString('en-GB')}</dd></div><div><dt>Expires</dt><dd>{new Date(license.expires_at).toLocaleDateString('en-GB')}</dd></div><div><dt>Devices</dt><dd>{license.bound_device_fingerprint ? '1 / 1 BOUND' : '0 / 1 BOUND'}</dd></div></dl></section><section className="section form-card"><p className="eyebrow">Owner edit</p><h2>Edit record</h2><p>Update the label, assigned MT5 account, or expiry. Changing the account clears the current device binding so it can bind once to the new account.</p><EditLicenseForm licenseId={id} initialLabel={license.customer_label} initialAccount={String(license.allowed_account ?? '')} initialDate={String(license.expires_at).slice(0, 10)} /></section><section className="side-note"><h3>Package delivery</h3><p>The activation package link writes to the audit ledger. Only distribute it through the agreed private channel.</p><Link href="/dashboard" className="panel-link">← Back to registry</Link></section></aside>
    </div>
  </main></div>;
}
