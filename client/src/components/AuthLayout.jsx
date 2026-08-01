import { Link } from "react-router";

export default function AuthLayout({
  title,
  description,
  footerText,
  footerLinkText,
  footerLinkTo,
  children,
}) {
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <Link className="brand" to="/">
          Playlist Tracker
        </Link>

        <h1>Finish the playlists you start.</h1>

        <p>
          Save YouTube playlists, remember where you stopped, and continue
          without hunting for the last video you watched.
        </p>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-header">
          <h2 id="auth-title">{title}</h2>
          <p>{description}</p>
        </div>

        {children}

        <p className="auth-footer">
          {footerText} <Link to={footerLinkTo}>{footerLinkText}</Link>
        </p>
      </section>
    </main>
  );
}
