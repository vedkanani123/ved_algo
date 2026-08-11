export default function LoginPage() {
  return <main className="login-page">
    <div className="login-wrap reveal">
      <div className="login-brand"><div className="wordmark"><span className="wordmark__mark">A</span><span>ALGO<span className="wordmark__muted">/OWNER</span></span></div><p>MetaTrader license authority</p></div>
      <section className="login-panel" aria-labelledby="login-title">
        <p className="eyebrow">Access control / 01</p><h1 id="login-title">Owner sign in</h1><p>Use the private publisher credentials assigned to this console.</p>
        <form method="post" action="/auth/login">
          <div className="field"><label htmlFor="email">Owner email</label><input id="email" name="email" type="email" placeholder="owner@publisher.com" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          <button className="button" type="submit">Continue to secure check <span aria-hidden="true">→</span></button>
        </form>
        <p className="security-note"><b>OWNER ACCESS ONLY</b><br />MFA is required immediately after sign in before license controls are available. There is no customer registration or client portal.</p>
      </section>
      <p className="login-foot">ENCRYPTED SESSION · AUTHORITY NODE IN</p>
    </div>
  </main>;
}
