import { ConsoleNav, IssueLicenseForm } from '../../../components/console-ui';
import { requireOwner } from '../../../lib/auth';

export default async function NewLicensePage() {
  await requireOwner();
  return <div className="app-shell"><ConsoleNav active="new" /><main className="main"><header className="topline"><div><p className="eyebrow">Registry / issue authority</p><h1>Issue a license</h1></div><p className="system-clock"><b>● OWNER CODE VERIFIED</b> &nbsp; SESSION S-92F1</p></header>
    <div className="form-layout"><section className="form-card"><p className="eyebrow">License parameters</p><h2>Create an activation record</h2><p>The generated license inherits the one-device enforcement policy. Bind an account now or leave it for the terminal&apos;s first successful handshake.</p>
      <IssueLicenseForm />
    </section><aside><div className="side-note"><h3>Issue protocol</h3><p>Each record receives a unique authorization key. Neither encrypted key material nor service credentials are ever shown here.</p></div><div className="side-note"><h3>Binding behavior</h3><p>When no account is supplied, the first valid terminal activation establishes the permitted account and device.</p></div></aside></div>
  </main></div>;
}
