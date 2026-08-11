import { ConsoleNav, IssueLicenseForm } from '../../../components/console-ui';
import { requireOwner } from '../../../lib/auth';

export default async function NewLicensePage() {
  await requireOwner();
  return <div className="app-shell"><ConsoleNav active="new" /><main className="main"><header className="topline"><div><p className="eyebrow">Registry / issue authority</p><h1>Issue a license</h1></div><p className="system-clock"><b>● OWNER CODE VERIFIED</b> &nbsp; SESSION S-92F1</p></header>
    <div className="form-layout"><section className="form-card"><p className="eyebrow">License parameters</p><h2>Create an activation record</h2><p>The generated license inherits the one-device enforcement policy. Bind an account now so the EA can authorize without shipping a readable license secret.</p>
      <IssueLicenseForm />
    </section><aside><div className="side-note"><h3>Issue protocol</h3><p>Each record receives a unique administrative key, but the downloadable MT5 package contains no secret. The EA uses HTTPS account/device binding.</p></div><div className="side-note"><h3>Binding behavior</h3><p>Keyless EA activation requires an allowed account number. Leave it blank only when using the legacy keyed handshake.</p></div></aside></div>
  </main></div>;
}
