import { LegalPage, Section, C, p, ul, li } from "@/components/LegalPage";

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="September 15, 2026" lastUpdated="September 15, 2026">
      <p style={p}>
        These Terms of Service (&ldquo;Terms&rdquo;) are a legal agreement between you and Lucas Align LLC (&ldquo;Lucas
        Align,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) governing your use of Steward, our personal
        dashboard and AI accountability app (the &ldquo;App&rdquo;).
      </p>
      <p style={{ ...p, marginBottom: 0 }}>
        By creating an account or using Steward, you agree to these Terms. If you don&rsquo;t agree, please don&rsquo;t use the
        App. See also our <a href="/privacy" style={{ color: C.brassSoft }}>Privacy Policy</a>, which explains how we handle your
        information and is incorporated into these Terms by reference.
      </p>

      <Section n={1} title="Eligibility">
        <p style={{ ...p, marginBottom: 0 }}>
          You must be at least 18 years old to create a Steward account. By using Steward, you represent that you meet this
          requirement and that you&rsquo;re legally able to enter into these Terms.
        </p>
      </Section>

      <Section n={2} title="Your Account">
        <ul style={ul}>
          <li style={li}>You&rsquo;re responsible for keeping your login credentials secure and for all activity under your
            account</li>
          <li style={li}>You agree to provide accurate information and keep it up to date</li>
          <li style={li}>Your account is for your own personal use &mdash; it isn&rsquo;t transferable, and you shouldn&rsquo;t
            share login access with anyone else</li>
          <li style={li}>Let us know right away at <a href="mailto:admin@lucasalign.com" style={{ color: C.brassSoft }}>admin@lucasalign.com</a> if
            you suspect unauthorized use of your account</li>
        </ul>
      </Section>

      <Section n={3} title="What Steward Is (and Isn't)">
        <p style={p}>
          Steward is a personal productivity and reflection tool: a daily dashboard, journal, task tracker, and AI
          accountability chat partner covering things like marriage and family intentions, work priorities, and weekly
          self-examination.
        </p>
        <p style={{ ...p, marginBottom: 0, fontWeight: 700, color: C.parchment }}>
          Steward is not a substitute for professional advice. It is not therapy, counseling, medical, legal, financial, or
          crisis intervention services, and Steward&rsquo;s AI chat is not a licensed professional. If you&rsquo;re in crisis or
          experiencing a mental health emergency, please contact the 988 Suicide &amp; Crisis Lifeline (call or text 988 in the
          US) or your local emergency services &mdash; not Steward.
        </p>
      </Section>

      <Section n={4} title="AI Features">
        <p style={p}>
          Steward&rsquo;s chat, onboarding interview, and personalized content (like your rotating Tribe intention) are
          generated using an AI model via OpenAI&rsquo;s API, informed by content you&rsquo;ve entered into the App (see our
          Privacy Policy, Section 3, for details on what&rsquo;s sent and why).
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          AI-generated responses can be inaccurate, incomplete, or simply wrong. Use your own judgment, and don&rsquo;t rely on
          Steward&rsquo;s AI output for decisions where being wrong could cause serious harm &mdash; medical, legal, financial,
          or safety-related.
        </p>
      </Section>

      <Section n={5} title="Your Content">
        <p style={p}>
          You own the journal entries, intentions, relationship notes, commitments, and everything else you create in Steward
          (&ldquo;Your Content&rdquo;). We don&rsquo;t claim ownership of it.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          You grant Lucas Align a limited license to host, store, and process Your Content solely to provide and improve the
          App to you &mdash; including sending relevant parts of it to OpenAI to power Steward&rsquo;s AI features. We don&rsquo;t
          use Your Content for advertising, and we don&rsquo;t sell it (see our Privacy Policy).
        </p>
      </Section>

      <Section n={6} title="Subscriptions &amp; Billing">
        <p style={p}>
          Steward is currently free to use. We plan to introduce a paid subscription in the future. Once that launches:
        </p>
        <ul style={ul}>
          <li style={li}>Subscriptions will renew automatically at the end of each billing period unless canceled</li>
          <li style={li}>Payment will be processed by Stripe; by subscribing, you also agree to Stripe&rsquo;s applicable terms</li>
          <li style={li}>You&rsquo;ll be able to cancel your subscription, which takes effect at the end of the current billing
            cycle &mdash; you keep access and your data isn&rsquo;t affected until then</li>
          <li style={li}>You&rsquo;ll separately be able to request immediate cancellation and deletion of your data, rather
            than just letting the subscription lapse</li>
        </ul>
        <p style={{ ...p, marginBottom: 0 }}>
          We&rsquo;ll update these Terms with complete pricing and billing details before any paid subscription becomes
          available, and no payment will be collected without your clear consent at that time.
        </p>
      </Section>

      <Section n={7} title="Acceptable Use">
        <p style={p}>You agree not to:</p>
        <ul style={{ ...ul, marginBottom: 0 }}>
          <li style={li}>Use Steward for any unlawful purpose</li>
          <li style={li}>Attempt to gain unauthorized access to another user&rsquo;s account or data</li>
          <li style={li}>Reverse engineer, decompile, or attempt to extract the source code of the App</li>
          <li style={li}>Scrape, crawl, or use automated means to access the App outside its intended use</li>
          <li style={li}>Interfere with or disrupt the App&rsquo;s operation, security, or infrastructure</li>
          <li style={li}>Impersonate another person or misrepresent your identity</li>
          <li style={li}>Use the App to harass, threaten, or harm another person</li>
        </ul>
      </Section>

      <Section n={8} title="Termination">
        <p style={p}>You can stop using Steward and request account deletion at any time (see our Privacy Policy, Section 6).</p>
        <p style={{ ...p, marginBottom: 0 }}>
          We may suspend or terminate your account if you violate these Terms, if required by law, or (once subscriptions
          exist) for non-payment. Where reasonably possible, we&rsquo;ll try to notify you first. Sections of these Terms that
          by their nature should survive termination &mdash; like ownership, disclaimers, and limitation of liability &mdash;
          will continue to apply.
        </p>
      </Section>

      <Section n={9} title="Intellectual Property">
        <p style={{ ...p, marginBottom: 0 }}>
          Steward&rsquo;s software, design, branding, and underlying technology belong to Lucas Align (or our licensors). Other
          than the limited license to use the App as intended, these Terms don&rsquo;t grant you any ownership rights in
          Steward itself.
        </p>
      </Section>

      <Section n={10} title="Third-Party Services">
        <p style={{ ...p, marginBottom: 0 }}>
          Steward relies on third-party services &mdash; including Google, Microsoft, OpenAI, Resend, and (once billing
          launches) Stripe &mdash; described in our Privacy Policy. Your use of features that rely on those services (like
          Google Calendar sync or Google/Microsoft sign-in) is also subject to that provider&rsquo;s own terms.
        </p>
      </Section>

      <Section n={11} title="Disclaimer of Warranties">
        <p style={{ ...p, marginBottom: 0, textTransform: "uppercase", fontSize: 13, letterSpacing: "0.02em" }}>
          Steward is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, express or
          implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We
          don&rsquo;t guarantee the App will be uninterrupted, error-free, secure, or that its AI-generated content will be
          accurate or complete.
        </p>
      </Section>

      <Section n={12} title="Limitation of Liability">
        <p style={{ ...p, marginBottom: 0, textTransform: "uppercase", fontSize: 13, letterSpacing: "0.02em" }}>
          To the maximum extent permitted by law, Lucas Align will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or any loss of data, arising from your use of Steward. Our total liability for
          any claim relating to the App will not exceed the greater of (a) the amount you paid us in the 12 months before the
          claim, or (b) $50.
        </p>
      </Section>

      <Section n={13} title="Indemnification">
        <p style={{ ...p, marginBottom: 0 }}>
          You agree to indemnify and hold Lucas Align harmless from any claims, damages, or expenses (including reasonable
          attorneys&rsquo; fees) arising from your misuse of the App or your violation of these Terms.
        </p>
      </Section>

      <Section n={14} title="Governing Law">
        <p style={{ ...p, marginBottom: 0 }}>
          These Terms are governed by the laws of the Commonwealth of Pennsylvania, without regard to its conflict-of-law
          rules. Any dispute arising from these Terms or your use of Steward will be brought in the state or federal courts
          located in Pennsylvania, and you consent to that venue.
        </p>
      </Section>

      <Section n={15} title="Changes to These Terms">
        <p style={{ ...p, marginBottom: 0 }}>
          We may update these Terms as Steward evolves or legal requirements change. The &ldquo;Last Updated&rdquo; date at the
          top reflects the most recent revision. If we make a material change, we&rsquo;ll let you know in the app or by email
          before it takes effect; continuing to use Steward after that means you accept the updated Terms.
        </p>
      </Section>

      <Section n={16} title="Contact Us">
        <p style={{ marginBottom: 0 }}>
          Lucas Align LLC<br />
          Pennsylvania, United States<br />
          Email: <a href="mailto:admin@lucasalign.com" style={{ color: C.brassSoft }}>admin@lucasalign.com</a><br />
          Website: <a href="https://lucasalign.com" style={{ color: C.brassSoft }} target="_blank" rel="noreferrer">LucasAlign.com</a>
        </p>
      </Section>
    </LegalPage>
  );
}
