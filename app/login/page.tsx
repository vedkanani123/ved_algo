import { getOwnerSession } from '../../lib/auth';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; access?: string }> }) {
  const params = await searchParams;
  const owner = await getOwnerSession();
  if (owner && !owner.accessCodeVerified) return <main className="login-page"><div className="login-wrap reveal"><div className="login-brand"><div className="wordmark"><span className="wordmark__mark">A</span><span>ALGO<span className="wordmark__muted">/OWNER</span></span></div><p>MetaTrader license authority</p></div><section className="login-panel" aria-labelledby="access-title"><p className="eyebrow">Access control / 02</p><h1 id="access-title">Enter owner access code</h1><p>Your password was accepted. Enter the fixed 16-digit owner code to unlock the private console.</p><form method="post" action="/auth/access-code"><div className="field"><label htmlFor="access-code">Owner access code</label><input id="access-code" name="accessCode" type="password" inputMode="numeric" pattern="[0-9]{16}" minLength={16} maxLength={16} autoComplete="one-time-code" required /></div><button className="button" type="submit">Unlock private console <span aria-hidden="true">→</span></button></form>{params.access === 'invalid' && <p className="inline-error" role="alert">The owner access code was not accepted.</p>}<p className="security-note"><b>OWNER ACCESS ONLY</b><br />This is a server-verified fixed code. It is never included in the public source code or sent back to the browser.</p></section></div></main>;
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
        {params.error === 'confirm' && <p className="inline-error" role="alert">Confirm your email before signing in, then try again.</p>}
        {params.error === 'invalid' && <p className="inline-error" role="alert">Email or password was not accepted.</p>}
        <p className="security-note"><b>OWNER ACCESS ONLY</b><br />A fixed, server-verified 16-digit access code is required after sign in. There is no customer registration or client portal.</p>
      </section>
      <p className="login-foot">ENCRYPTED SESSION · AUTHORITY NODE IN</p>
    </div>
  </main>;
}
