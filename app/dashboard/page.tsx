import Link from 'next/link';
import { ConsoleNav, EmptyState, LicenseStatus, type LicenseState } from '../../components/console-ui';
import { requireOwner } from '../../lib/auth';
import { listLicenses } from '../../lib/licenses';

export default async function DashboardPage() {
  await requireOwner();
  const licenses = await listLicenses();
  const now = Date.now();
  const expiring = licenses.filter((license) => license.status === 'active' && new Date(license.expires_at).getTime() - now < 14 * 86_400_000 && new Date(license.expires_at).getTime() > now).length;
  const active = licenses.filter((license) => license.status === 'active').length;
  const live = licenses.filter((license) => license.last_seen_at && now - new Date(license.last_seen_at).getTime() < 86_400_000).length;
  return <div className="app-shell"><ConsoleNav active="dashboard" /><main className="main">
    <header className="topline reveal"><div><p className="eyebrow">Authority overview / live</p><h1>License operations</h1></div><p className="system-clock"><b>● SYSTEM NOMINAL</b> &nbsp; 11 AUG 2026 · 14:32 IST</p></header>
    <section className="stats reveal delay-1" aria-label="License statistics">
      <article className="stat"><span className="stat__label">Active licenses</span><strong>{active}</strong><small>valid authorization records</small></article>
      <article className="stat stat--amber"><span className="stat__label">Expiring soon</span><strong>{expiring}</strong><small>within the next 14 days</small></article>
      <article className="stat stat--danger"><span className="stat__label">Blocked today</span><strong>—</strong><small>review terminal events below</small></article>
      <article className="stat"><span className="stat__label">Live accounts</span><strong>{live}</strong><small>last heartbeat under 24h</small></article>
    </section>
    <div className="dashboard-grid reveal delay-2"><section id="licenses"><header className="panel-header"><div><p className="eyebrow">Registry / latest activity</p><h2>License register</h2></div><Link className="panel-link" href="/licenses/new">+ Issue license</Link></header>{licenses.length === 0 ? <EmptyState title="No licenses issued">Create the first activation record when you are ready to deliver an EA.</EmptyState> : <div className="data-panel table-wrap"><table className="data-table"><thead><tr><th>Customer label</th><th>License</th><th>Trading account</th><th>Expiry</th><th>Status</th></tr></thead><tbody>{licenses.map((license) => <tr key={license.id}><td className="primary-cell"><Link href={`/licenses/${license.id}`}>{license.customer_label}</Link></td><td className="mono">{license.id.slice(0, 8)}</td><td className="mono muted">{license.allowed_account ?? 'Not bound'}</td><td className="mono">{new Date(license.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td><LicenseStatus status={license.status as LicenseState} /></td></tr>)}</tbody></table></div>}</section>
    <aside><header className="panel-header"><div><p className="eyebrow">Terminal wire / last 90 min</p><h2>Recent heartbeats</h2></div></header><div className="event-stream"><article className="event"><i className="event__rail" /><div><div className="event__title">Orion Quant terminal accepted</div><div className="event__detail">ACC 87234190 · WIN-8D2A</div></div><time>14:31</time></article><article className="event event--warn"><i className="event__rail" /><div><div className="event__title">Apex Trade Lab expires in 3 days</div><div className="event__detail">ALGO-A8C0 · NO BINDING</div></div><time>14:18</time></article><article className="event"><i className="event__rail" /><div><div className="event__title">Harbor Algo Desk heartbeat</div><div className="event__detail">ACC 65721104 · 0.8.1</div></div><time>13:58</time></article><article className="event event--warn"><i className="event__rail" /><div><div className="event__title">Rejected device fingerprint</div><div className="event__detail">ALGO-77E2 · NEW HARDWARE</div></div><time>13:41</time></article></div></aside></div>
  </main></div>;
}
