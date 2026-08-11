import { ConsoleNav, IssueLicenseForm } from '../../../components/console-ui';
import { requireOwner } from '../../../lib/auth';

export default async function NewLicensePage() {
  await requireOwner();
  return <div className="app-shell"><ConsoleNav active="new" /><main className="main"><header className="topline"><div><p className="eyebrow">Registry / issue authority</p><h1>Issue a license</h1></div><p className="system-clock"><b>● OWNER CODE VERIFIED</b> &nbsp; SESSION S-92F1</p></header>
    <div className="form-layout"><section className="form-card"><p className="eyebrow">License parameters</p><h2>Create an activation record</h2><p>The EA reads the MT5 account automatically at runtime and sends balance, equity, positions, and deals to this dashboard. You may bind an account now or leave it empty for automatic first-run binding.</p>
      <IssueLicenseForm />
    </section><aside><div className="side-note"><h3>Issue protocol</h3><p>Each record receives a unique activation Magic Number. The downloadable package contains no license secret; the server still enforces one account and one device.</p></div><div className="side-note"><h3>Binding behavior</h3><p>If account is blank, the first valid EA handshake binds the detected account and device to this package. Reusing the package elsewhere is rejected after binding.</p></div></aside></div>
  </main></div>;
}
