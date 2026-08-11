'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="login-page"><section className="login-panel" aria-labelledby="error-title"><p className="eyebrow">Console recovery</p><h1 id="error-title">This page could not be loaded</h1><p>The owner session is safe. Retry the request, or return to the overview.</p><div className="page-actions"><button className="button" type="button" onClick={() => reset()}>Retry</button><a className="button button--ghost" href="/dashboard">Back to overview</a></div></section></main>;
}
