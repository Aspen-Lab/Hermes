"use client";

// Root-level crash screen. This replaces the entire root layout, so
// globals.css and next/font are NOT available here — plain inline styles
// with the cream-theme defaults are the only safe option.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#fdf6ee",
          color: "#2a2722",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "18vh 24px 0" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#94877c",
            }}
          >
            Error
          </p>
          <h1
            style={{
              margin: "12px 0 0",
              fontSize: 22,
              fontWeight: 600,
              color: "#2b180a",
            }}
          >
            Peer hit an unexpected error.
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: "#6b6156" }}>
            Reloading usually clears it. Your profile and saved items are
            stored locally and in your account.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 28,
              height: 40,
              padding: "0 20px",
              borderRadius: 999,
              border: "none",
              background: "#ff520d",
              color: "#fdf6ee",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error?.digest ? (
            <p style={{ marginTop: 32, fontSize: 12, color: "#94877c", fontFamily: "monospace" }}>
              ref {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
