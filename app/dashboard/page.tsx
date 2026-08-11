import Link from 'next/link';
import { ConsoleNav, EmptyState, LicenseStatus, type LicenseState } from '../../components/console-ui';
import { requireOwner } from '../../lib/auth';
import { listLicenses, listRecentHeartbeats } from '../../lib/licenses';

export default async function DashboardPage() {
  await requireOwner();
  const [licenses, heartbeats] = await Promise.all([listLicenses(), listRecentHeartbeats()]);
  const now = Date.now();
  const expiring = licenses.filter((license) => license.status === 'active' && new Date(license.expires_at).getTime() - now < 14 * 86_400_000 && new Date(license.expires_at).getTime() > now).length;
  const active = licenses.filter((license) => license.status === 'active').length;
  const live = licenses.filter((license) => license.last_seen_at && now - new Date(license.last_seen_at).getTime() < 86_400_000).length;
  const systemClock = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()).toUpperCase();
  return <div className="app-shell"><ConsoleNav active="dashboard" /><main className="main">
    <header className="topline reveal"><div><p className="eyebrow">Authority overview / live</p><h1>License operations</h1></div><p className="system-clock"><b>● SYSTEM NOMINAL</b> &nbsp; {systemClock} IST</p></header>
    <section className="stats reveal delay-1" aria-label="License statistics">
      <article className="stat"><span className="stat__label">Active licenses</span><strong>{active}</strong><small>valid authorization records</small></article>
      <article className="stat stat--amber"><span className="stat__label">Expiring soon</span><strong>{expiring}</strong><small>within the next 14 days</small></article>
      <article className="stat stat--danger"><span className="stat__label">Blocked today</span><strong>—</strong><small>review terminal events below</small></article>
      <article className="stat"><span className="stat__label">Live accounts</span><strong>{live}</strong><small>last heartbeat under 24h</small></article>
    </section>
    <div className="dashboard-grid reveal delay-2"><section id="licenses"><header className="panel-header"><div><p className="eyebrow">Registry / latest activity</p><h2>License register</h2></div><Link className="panel-link" href="/licenses/new">+ Issue license</Link></header>{licenses.length === 0 ? <EmptyState title="No licenses issued">Create the first activation record when you are ready to deliver an EA.</EmptyState> : <div className="data-panel table-wrap"><table className="data-table"><thead><tr><th>Customer label</th><th>License</th><th>Trading account</th><th>Expiry</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{licenses.map((license) => { const expiresAt = new Date(license.expires_at).getTime(); const status = license.status === 'active' && expiresAt > now && expiresAt - now < 14 * 86_400_000 ? 'expiring' : license.status; return <tr key={license.id}><td className="primary-cell"><Link href={`/licenses/${license.id}`}>{license.customer_label}</Link></td><td className="mono">{license.id.slice(0, 8)}</td><td className="mono muted">{license.allowed_account ?? 'Not bound'}</td><td className="mono">{new Date(license.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td><LicenseStatus status={status as LicenseState} /></td><td className="action-cell"><Link href={`/licenses/${license.id}`} aria-label={`Open ${license.customer_label}`}>Open <span aria-hidden="true">→</span></Link></td></tr>; })}</tbody></table></div>}</section>
    <aside><header className="panel-header"><div><p className="eyebrow">Terminal wire / live</p><h2>Recent heartbeats</h2></div></header>{heartbeats.length === 0 ? <EmptyState title="No terminal heartbeats">Accepted EA handshakes will appear here with the account, device, and build.</EmptyState> : <div className="event-stream">{heartbeats.map((heartbeat) => { const license = licenses.find((item) => item.id === heartbeat.license_id); return <article className="event" key={heartbeat.id}><i className="event__rail" /><div><div className="event__title">{license?.customer_label ?? 'License terminal'} accepted</div><div className="event__detail">ACC {heartbeat.account_number} · {heartbeat.device_fingerprint} · {heartbeat.ea_version}</div></div><time>{new Date(heartbeat.received_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</time></article>; })}</div>}</aside></div>
  </main></div>;
}
