'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
      <button className="mobile-menu" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="owner-console-navigation" onClick={() => setOpen(!open)}>☰</button>
      <aside id="owner-console-navigation" className={`sidebar ${open ? 'sidebar--open' : ''}`}>
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
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'suspend' | 'revoke' | 'delete'>('idle');
  const [phrase, setPhrase] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const action = mode === 'revoke' ? 'revoke' : mode === 'delete' ? 'delete' : 'suspend';
  const requiredPhrase = mode === 'revoke' ? 'REVOKE' : mode === 'delete' ? 'DELETE LICENSE' : 'SUSPEND LICENSE';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setPending(true);
    try {
      const body = action === 'suspend' ? { action } : { action, confirmation: requiredPhrase };
      const response = await fetch(`/api/licenses/${licenseId}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null);
      if (!response.ok) return setMessage(result?.error || 'The enforcement action was rejected. Confirm your session and try again.');
      if (action === 'delete') {
        router.push('/dashboard');
        router.refresh();
        return;
      }
      setMessage(`License ${action === 'suspend' ? 'suspended' : 'revoked'}. The audit ledger has been updated.`);
      setPhrase('');
      setMode('idle');
      router.refresh();
    } catch {
      setMessage('The request could not be completed. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }
  return <section className="danger-zone">
    <div><p className="eyebrow">High-impact controls</p><h2>License enforcement</h2><p>Suspension can be reversed. Revocation permanently rejects this key. Deletion removes the record and activation history from the registry.</p></div>
    <div className="danger-zone__actions">
      <button className="button button--ghost" type="button" onClick={() => setMode('suspend')}>Suspend license</button>
      <button className="button button--danger" type="button" onClick={() => setMode('revoke')}>Revoke license</button>
      <button className="button button--danger" type="button" onClick={() => setMode('delete')}>Delete record</button>
    </div>
    {mode !== 'idle' && <form className="confirmation" onSubmit={submit}>
      <label htmlFor="confirmation-phrase">Type <code>{requiredPhrase}</code> to confirm</label>
      <div><input id="confirmation-phrase" name="confirmation" value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" autoFocus aria-describedby={mode === 'delete' ? 'confirmation-help' : undefined} /><button className="button button--danger" type="submit" disabled={phrase !== requiredPhrase || pending}>{pending ? 'Working…' : `Confirm ${action}`}</button><button className="text-button" type="button" onClick={() => { setMode('idle'); setPhrase(''); }} disabled={pending}>Cancel</button></div>
      {mode === 'delete' && <small id="confirmation-help" className="confirmation__warning">This cannot be undone. Existing audit rows are retained without the deleted license record.</small>}
    </form>}
    {message && <p className={message.includes('rejected') || message.includes('could not') ? 'inline-error' : 'toast'} role="status" aria-live="polite">{message}</p>}
  </section>;
}

export function IssueLicenseForm() {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setPending(true);
    const form = new FormData(event.currentTarget);
    const expires = String(form.get('expiresAt'));
    try {
      const response = await fetch('/api/licenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: form.get('label'), allowedAccount: form.get('allowedAccount') || null, expiresAt: `${expires}T23:59:59.000Z` }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) return setMessage(result?.error || 'License could not be issued. Check the values and try again.');
      window.location.assign(`/licenses/${result.id}`);
    } catch {
      setMessage('The request could not be completed. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }
  return <form onSubmit={submit}><div className="form-grid"><div className="field field--full"><label htmlFor="label">Customer label</label><input id="label" name="label" placeholder="e.g. Orion Quant / EUR" required disabled={pending} /><small>Internal reference only. This label appears in the private registry.</small></div><div className="field"><label htmlFor="expiry">Expiry date</label><input id="expiry" name="expiresAt" type="date" required disabled={pending} /></div><div className="field"><label htmlFor="account">Allowed account number</label><input id="account" name="allowedAccount" inputMode="numeric" placeholder="e.g. 87234190" required disabled={pending} /><small>Required for the keyless EA handshake and one-device binding.</small></div><div className="field"><label htmlFor="devices">Permitted device count</label><input id="devices" name="deviceCount" value="1" readOnly aria-readonly="true" disabled={pending} /></div><div className="field"><label htmlFor="note">Operator note <span className="muted">(optional)</span></label><input id="note" name="note" placeholder="Invoice or delivery reference" disabled={pending} /></div><div className="notice field--full"><strong>ACCOUNT-BOUND ACTIVATION PACKAGE</strong><br />The downloaded <code>.set</code> file contains no license secret. Attach the EA, set Magic Number, and allow the API origin in MT5 WebRequest settings.</div></div><div className="form-actions"><button className="button" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create license →'}</button><small>Creates an immutable audit event.</small></div>{message && <p className="inline-error" role="alert" aria-live="polite">{message}</p>}</form>;
}

export function ExpiryForm({ licenseId, initialDate }: { licenseId: string; initialDate: string }) {
  return <EditLicenseForm licenseId={licenseId} initialLabel="" initialAccount="" initialDate={initialDate} expiryOnly />;
}

export function EditLicenseForm({ licenseId, initialLabel, initialAccount, initialDate, expiryOnly = false }: { licenseId: string; initialLabel: string; initialAccount: string; initialDate: string; expiryOnly?: boolean }) {
  const router = useRouter();
  const [label, setLabel] = useState(initialLabel);
  const [account, setAccount] = useState(initialAccount);
  const [date, setDate] = useState(initialDate);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const cleanLabel = label.trim();
    if (!expiryOnly && cleanLabel.length === 0) return setError('Customer label is required.');
    if (!expiryOnly && !/^\d{1,18}$/.test(account)) return setError('Enter a valid numeric MT5 account number.');
    if (!date || new Date(`${date}T23:59:59.000Z`).getTime() <= Date.now()) return setError('Expiry must be a future date.');
    setPending(true);
    try {
      const body = expiryOnly
        ? { action: 'extend', expiresAt: `${date}T23:59:59.000Z` }
        : { action: 'update', label: cleanLabel, allowedAccount: account, expiresAt: `${date}T23:59:59.000Z` };
      const response = await fetch(`/api/licenses/${licenseId}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null);
      if (!response.ok) return setError(result?.error || 'Record could not be updated. Check the values and try again.');
      setMessage(expiryOnly ? 'Expiry saved. Terminal verification will use it on the next heartbeat.' : result?.deviceBindingReset ? 'Record saved. The previous device binding was cleared for the new account.' : 'Record saved.');
      router.refresh();
    } catch {
      setError('The request could not be completed. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (expiryOnly) return <form onSubmit={submit}><div className="field"><label htmlFor="new-expiry">New expiry</label><input id="new-expiry" type="date" name="expiresAt" value={date} onChange={(event) => setDate(event.target.value)} required /></div><div className="form-actions"><button className="button button--small" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save expiry'}</button></div>{error && <p className="inline-error" role="alert" aria-live="polite">{error}</p>}{message && <p className="toast" role="status" aria-live="polite">{message}</p>}</form>;

  return <form onSubmit={submit} className="edit-record-form" noValidate>
    <div className="form-grid">
      <div className="field field--full"><label htmlFor="edit-label">Customer label</label><input id="edit-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} required /><small>Use a recognizable internal label. Maximum 120 characters.</small></div>
      <div className="field"><label htmlFor="edit-account">Allowed account number</label><input id="edit-account" value={account} onChange={(event) => setAccount(event.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={18} required /><small>Changing this clears the current device binding.</small></div>
      <div className="field"><label htmlFor="edit-expiry">Expiry date</label><input id="edit-expiry" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /><small>Must remain in the future.</small></div>
    </div>
    <div className="form-actions"><button className="button button--small" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save record'}</button><small>Changes are written to the audit ledger.</small></div>
    {error && <p className="inline-error" role="alert" aria-live="polite">{error}</p>}
    {message && <p className="toast" role="status" aria-live="polite">{message}</p>}
  </form>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><span>—</span><h2>{title}</h2><p>{children}</p></div>;
}

export function SkeletonRows() {
  return <div className="skeleton-table" aria-label="Loading licenses"><i /><i /><i /></div>;
}
