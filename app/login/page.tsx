export default function LoginPage() {
  return (
    <section className="panel" style={{ maxWidth: 560, margin: "5rem auto" }}>
      <p className="eyebrow">STEAM ACCOUNT</p>
      <h1>Sign in to Mindcheck.</h1>
      <p className="muted">
        Steam verifies your identity. Mindcheck never receives your Steam password.
      </p>
      <a className="primary" href="/api/auth/steam" style={{ display: "inline-flex", marginTop: 24 }}>
        Sign in through Steam
      </a>
    </section>
  );
}
