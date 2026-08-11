'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useState } from 'react';

export type LicenseState = 'active' | 'expiring' | 'suspended' | 'revoked' | 'blocked';

export function LicenseStatus({ status }: { status: LicenseState }) {
  const labels: Record<LicenseState, string> = {
    active: 'Valid',
    expiring: 'Expiring',
    suspended: 'Suspended',
    revoked: 'Revoked',
    blocked: 'Blocked',
  };
  return <span className={`status status--${status}`}><i aria-hidden="true" />{labels[status]}</span>;
}

export function ConsoleNav({ active }: { active: 'dashboard' | 'licenses' | 'new' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="mobile-menu" aria-label="Open navigation" onClick={() => setOpen(!open)}>☰</button>
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <Link href="/dashboard" className="wordmark" onClick={() => setOpen(false)}>
          <span className="wordmark__mark">A</span><span>ALGO<span className="wordmark__muted">/OWNER</span></span>
        </Link>
        <p className="side-eyebrow">Private operations</p>
        <nav aria-label="Console navigation">
          <Link href="/dashboard" className={active === 'dashboard' ? 'nav-item nav-item--active' : 'nav-item'}><span>01</span>Overview</Link>
          <Link href="/dashboard#licenses" className={active === 'licenses' ? 'nav-item nav-item--active' : 'nav-item'}><span>02</span>Licenses</Link>
          <Link href="/licenses/new" className={active === 'new' ? 'nav-item nav-item--active' : 'nav-item'}><span>03</span>Issue license</Link>
        </nav>
        <div className="sidebar__bottom">
          <div className="secure-card"><span className="secure-dot" />SESSION SECURED<br /><small>OWNER ACCESS CODE VERIFIED · RESTRICTED MATERIAL ENABLED</small></div>
          <form method="post" action="/auth/logout"><button className="logout" type="submit">↗ Sign out</button></form>
        </div>
      </aside>
    </>
  );
}

export function LicenseKey({ value }: { value?: string }) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return <div className="license-key"><code>ALGO-••••-••••-••••-••••</code><span className="key-locked">Owner access code required</span></div>;
  return <div className="license-key"><code>{revealed ? value : 'ALGO-••••-••••-••••-••••'}</code><button type="button" className="text-button" onClick={() => setRevealed(!revealed)}>{revealed ? 'Mask key' : 'Reveal verified key'}</button></div>;
}

export function DangerAction({ licenseId }: { licenseId: string }) {
  const [mode, setMode] = useState<'idle' | 'suspend' | 'revoke'>('idle');
  const [phrase, setPhrase] = useState('');
  const [message, setMessage] = useState('');
  const action = mode === 'revoke' ? 'revoke' : 'suspend';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const response = await fetch(`/api/licenses/${licenseId}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'revoke' ? { action, confirmation: 'REVOKE' } : { action }) });
    if (!response.ok) return setMessage('The enforcement action was rejected. Confirm your session and try again.');
    setMessage(`License ${action}d. The audit ledger has been updated.`);
    setMode('idle');
  }
  return <section className="danger-zone">
    <div><p className="eyebrow">Irreversible controls</p><h2>License enforcement</h2><p>Suspension can be reversed. Revocation permanently rejects this key and any future terminal handshake.</p></div>
    <div className="danger-zone__actions">
      <button className="button button--ghost" type="button" onClick={() => setMode('suspend')}>Suspend license</button>
      <button className="button button--danger" type="button" onClick={() => setMode('revoke')}>Revoke license</button>
    </div>
    {mode !== 'idle' && <form className="confirmation" onSubmit={submit}>
      <label htmlFor="confirmation-phrase">Type <code>{mode === 'revoke' ? 'REVOKE' : 'SUSPEND LICENSE'}</code> to confirm</label>
      <div><input id="confirmation-phrase" name="confirmation" value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" /><button className="button button--danger" type="submit" disabled={phrase !== (mode === 'revoke' ? 'REVOKE' : 'SUSPEND LICENSE')}>Confirm {action}</button><button className="text-button" type="button" onClick={() => setMode('idle')}>Cancel</button></div>
    </form>}
    {message && <p className={message.startsWith('The ') ? 'inline-error' : 'toast'} role="status">{message}</p>}
  </section>;
}

export function IssueLicenseForm() {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    const form = new FormData(event.currentTarget);
    const expires = String(form.get('expiresAt'));
    const response = await fetch('/api/licenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: form.get('label'), allowedAccount: form.get('allowedAccount') || null, expiresAt: `${expires}T23:59:59.000Z` }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return setMessage(result?.error || 'License could not be issued. Check the values and try again.');
    window.location.assign(`/licenses/${result.id}`);
  }
  return <form onSubmit={submit}><div className="form-grid"><div className="field field--full"><label htmlFor="label">Customer label</label><input id="label" name="label" placeholder="e.g. Orion Quant / EUR" required /><small>Internal reference only. This label appears in the private registry.</small></div><div className="field"><label htmlFor="expiry">Expiry date</label><input id="expiry" name="expiresAt" type="date" required /></div><div className="field"><label htmlFor="account">Allowed account number</label><input id="account" name="allowedAccount" inputMode="numeric" placeholder="e.g. 87234190" required /><small>Required for the keyless EA handshake and one-device binding.</small></div><div className="field"><label htmlFor="devices">Permitted device count</label><input id="devices" name="deviceCount" value="1" readOnly aria-readonly="true" /><small>Fixed by the license policy.</small></div><div className="field"><label htmlFor="note">Operator note <span className="muted">(optional)</span></label><input id="note" name="note" placeholder="Invoice or delivery reference" /></div><div className="notice field--full"><strong>ACCOUNT-BOUND ACTIVATION PACKAGE</strong><br />The downloaded <code>.set</code> file contains no license secret. Attach the EA, set Magic Number, and allow the API origin in MT5 WebRequest settings.</div></div><div className="form-actions"><button className="button" type="submit">Create license →</button><small>Creates an immutable audit event.</small></div>{message && <p className="inline-error" role="alert">{message}</p>}</form>;
}

export function ExpiryForm({ licenseId, initialDate }: { licenseId: string; initialDate: string }) {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setMessage(''); const date = String(new FormData(event.currentTarget).get('expiresAt')); const response = await fetch(`/api/licenses/${licenseId}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'extend', expiresAt: `${date}T23:59:59.000Z` }) }); if (!response.ok) return setMessage('Expiry could not be updated. Use a future date and try again.'); setMessage('Expiry saved. Terminal verification will use it on the next heartbeat.'); }
  return <form onSubmit={submit}><div className="field"><label htmlFor="new-expiry">New expiry</label><input id="new-expiry" type="date" name="expiresAt" defaultValue={initialDate} required /></div><div className="form-actions"><button className="button button--small" type="submit">Save expiry</button></div>{message && <p className="toast" role="status">{message}</p>}</form>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><span>—</span><h2>{title}</h2><p>{children}</p></div>;
}

export function SkeletonRows() {
  return <div className="skeleton-table" aria-label="Loading licenses"><i /><i /><i /></div>;
}
