import { Link } from "wouter";

export const C = {
  parchment: "#EEE4C4", parchmentMid: "#D2C7A2", parchmentDim: "#9C9272",
  brass: "#D8AA3E", brassSoft: "#C89A34",
};
export const F = "'Calibri','Segoe UI','Gill Sans MT','Helvetica Neue',sans-serif";

export const p: React.CSSProperties = { marginBottom: 12 };
export const ul: React.CSSProperties = { margin: "0 0 12px 22px", padding: 0 };
export const li: React.CSSProperties = { marginBottom: 4 };

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: C.brass, letterSpacing: "0.02em", marginBottom: 10 }}>
        {n}. {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.75, color: C.parchmentMid }}>{children}</div>
    </section>
  );
}

export function LegalPage({ title, effectiveDate, lastUpdated, children }: {
  title: string; effectiveDate: string; lastUpdated: string; children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", fontFamily: F, display: "flex", justifyContent: "center", padding: "48px 20px 80px" }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <Link href="/" style={{ color: C.brassSoft, fontSize: 14, textDecoration: "none" }}>&larr; Back to Steward</Link>

        <h1 style={{ fontSize: 32, fontWeight: 400, color: C.parchment, letterSpacing: "-0.01em", marginTop: 18, marginBottom: 4 }}>
          {title}
        </h1>
        <p style={{ color: C.parchmentDim, fontSize: 14, marginBottom: 28 }}>
          Effective Date: {effectiveDate} &nbsp;&middot;&nbsp; Last Updated: {lastUpdated}
        </p>

        {children}
      </div>
    </div>
  );
}
