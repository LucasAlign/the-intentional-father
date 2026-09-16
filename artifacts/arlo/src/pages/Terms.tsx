import { useEffect } from "react";

const TERMS_URL = "https://lucasalign.com/steward/terms.html";

// See Privacy.tsx — same reasoning, kept only for old bookmarks/links to /terms.
export default function Terms() {
  useEffect(() => {
    window.location.replace(TERMS_URL);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <a href={TERMS_URL} style={{ color: "#C89A34" }}>Continue to the Terms of Service</a>
    </div>
  );
}
