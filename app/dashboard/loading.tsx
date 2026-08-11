import { ConsoleNav, SkeletonRows } from '../../components/console-ui';

export default function DashboardLoading() {
  return <div className="app-shell" aria-busy="true" aria-label="Loading license operations">
    <ConsoleNav active="dashboard" />
    <main className="main">
      <header className="topline"><div><p className="eyebrow">Authority overview / loading</p><h1>License operations</h1></div><p className="system-clock">Loading registry…</p></header>
      <section className="stats" aria-hidden="true"><article className="stat"><span className="stat__label">Active licenses</span><strong>—</strong><small>loading current state</small></article><article className="stat"><span className="stat__label">Expiring soon</span><strong>—</strong><small>loading current state</small></article><article className="stat"><span className="stat__label">Blocked today</span><strong>—</strong><small>loading current state</small></article><article className="stat"><span className="stat__label">Live accounts</span><strong>—</strong><small>loading current state</small></article></section>
      <div className="dashboard-grid"><section><header className="panel-header"><div><p className="eyebrow">Registry</p><h2>License register</h2></div></header><SkeletonRows /></section><aside><header className="panel-header"><div><p className="eyebrow">Terminal wire</p><h2>Recent heartbeats</h2></div></header><SkeletonRows /></aside></div>
    </main>
  </div>;
}
