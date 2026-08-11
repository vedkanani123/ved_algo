import Link from 'next/link';

export default function NotFound() {
  return <main className="login-page"><section className="login-panel" aria-labelledby="not-found-title"><p className="eyebrow">Registry lookup</p><h1 id="not-found-title">Record not found</h1><p>This license record does not exist or is no longer available.</p><Link className="button" href="/dashboard">Back to overview <span aria-hidden="true">→</span></Link></section></main>;
}
