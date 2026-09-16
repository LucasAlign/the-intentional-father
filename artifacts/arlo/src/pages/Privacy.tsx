import { useEffect } from "react";

const PRIVACY_URL = "https://lucasalign.com/steward/privacy.html";

// The Privacy Policy now lives on LucasAlign.com, on the same domain as
// Steward's "Application home page" (lucasalign.com/steward) — Google's OAuth
// consent screen requires those to match, which 1arlo.replit.app no longer
// did once the home page moved there. This route stays only so old
// bookmarks/links to /privacy still land somewhere useful.
export default function Privacy() {
  useEffect(() => {
    window.location.replace(PRIVACY_URL);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <a href={PRIVACY_URL} style={{ color: "#C89A34" }}>Continue to the Privacy Policy</a>
    </div>
  );
}
