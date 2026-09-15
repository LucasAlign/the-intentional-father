import { LegalPage, Section, C, p, ul, li } from "@/components/LegalPage";

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="September 15, 2026" lastUpdated="September 15, 2026">
      <p style={p}>
        This Privacy Policy explains how Lucas Align LLC (&ldquo;Lucas Align,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) collects, uses, stores, protects, and discloses information in connection with Steward, our personal
        dashboard and AI accountability app for daily reflection, marriage and family intentions, work priorities, and habit
        tracking (the &ldquo;App&rdquo;).
      </p>
      <p style={p}>
        Steward is a personal app: your account and everything in it belongs to you, not to an employer, church, agency, or any
        other organization. There is no administrator who can see your data other than you and, in the limited circumstances
        described below, Lucas Align itself.
      </p>
      <p style={p}>
        Some of what you put into Steward is unusually personal &mdash; journal entries, marriage and parenting intentions,
        relationship notes, and conversations with Steward&rsquo;s AI chat. We built this Policy to be specific about what that
        means in practice, not just to satisfy a legal checklist.
      </p>
      <p style={p}>
        By creating an account or using Steward, you agree to the practices described in this Policy and our{" "}
        <a href="/terms" style={{ color: C.brassSoft }}>Terms of Service</a>.
      </p>

      <Section n={1} title="Information We Collect">
        <p style={p}><strong style={{ color: C.parchment }}>Account information.</strong> Name and email address (from Google,
          Microsoft, or email sign-in), and, if you sign in with Google or Microsoft, the basic profile fields those providers
          share with us. We never see or store your Google/Microsoft password.</p>

        <p style={p}><strong style={{ color: C.parchment }}>Onboarding &amp; profile information.</strong> Answers you give
          during Steward&rsquo;s onboarding interview or &ldquo;Edit My Answers&rdquo; screen &mdash; season of life, top
          priority, values, planning preferences, guardrails, and your preferred Steward chat tone.</p>

        <p style={p}><strong style={{ color: C.parchment }}>Personal &amp; family content you create.</strong> This is the
          core of the app:</p>
        <ul style={ul}>
          <li style={li}>Daily journal entries and marriage/parenting/friendship intentions</li>
          <li style={li}>Task priorities and their history</li>
          <li style={li}>People in your Tribe (relationships), including names, category, notes, standing commitments, and
            biggest challenges you record about them</li>
          <li style={li}>Commitments you log or keep, and who they&rsquo;re for</li>
          <li style={li}>Jobs, businesses, and other pursuits, including notes you add to them</li>
          <li style={li}>Sphere check-ins (weekly self-examination across family, self, community, provision, and leadership)
            and Pulse Check entries, including any free-text notes or walkthrough answers</li>
          <li style={li}>Custom verses you add yourself, and which bank verses you favorite</li>
          <li style={li}>Calendar items you add manually, and events read from a Google Calendar you choose to connect
            (read-only &mdash; Steward cannot create, edit, or delete events in your Google Calendar)</li>
        </ul>

        <p style={p}><strong style={{ color: C.parchment }}>Conversations with Steward.</strong> Messages you send to
          Steward&rsquo;s AI chat and the AI-driven onboarding interview, and Steward&rsquo;s replies.</p>

        <p style={p}><strong style={{ color: C.parchment }}>Communications.</strong> If you enable commitment reminder emails,
          the email address you choose to receive them at (which can be different from your login email), and delivery status.
          Support emails you send us.</p>

        <p style={p}><strong style={{ color: C.parchment }}>Payment information</strong> <em>(once available).</em> Steward
          plans to offer a paid subscription. When it launches, subscription and payment details will be handled by Stripe,
          our payment processor &mdash; Lucas Align does not receive or store your full card number. We&rsquo;ll receive
          limited billing information from Stripe such as your subscription status, plan, and billing history.</p>

        <p style={p}><strong style={{ color: C.parchment }}>Technical &amp; usage information.</strong> IP address, browser and
          device type, general log/error information, and login activity &mdash; collected automatically to operate, secure,
          and troubleshoot the App.</p>

        <p style={{ ...p, marginBottom: 0 }}><strong style={{ color: C.parchment }}>Cookies &amp; local storage.</strong>
          Steward uses one session cookie to keep you signed in (it expires after 90 days of inactivity) and your browser&rsquo;s
          local storage to remember on-device preferences &mdash; things like which hints you&rsquo;ve dismissed and which
          calendar filters you&rsquo;ve toggled. We do not use advertising cookies, tracking pixels, or any third-party
          analytics or tracking service &mdash; Steward has none installed, full stop.</p>
      </Section>

      <Section n={2} title="How We Use Information">
        <p style={p}>We use the information above only to:</p>
        <ul style={ul}>
          <li style={li}>Provide, operate, and maintain your Steward account and its features</li>
          <li style={li}>Power Steward&rsquo;s AI chat, onboarding interview, and personalized content (like your daily verse,
            rotating Tribe intention, and proactive check-ins) by sending relevant context to our AI provider</li>
          <li style={li}>Send commitment reminder emails and login codes you&rsquo;ve requested</li>
          <li style={li}>Sync your Google Calendar events into your Coming Up view, if you&rsquo;ve connected one</li>
          <li style={li}>Secure your account, investigate abuse, and troubleshoot technical problems</li>
          <li style={li}>Understand aggregate feature usage so we can improve the App</li>
          <li style={li}>Process payment, once subscriptions launch, through Stripe</li>
          <li style={li}>Comply with legal obligations and enforce our terms</li>
        </ul>
        <p style={{ ...p, marginBottom: 0 }}>
          <strong style={{ color: C.parchment }}>We do not use your journal, intentions, relationship, or chat content for
          advertising, and we do not build advertising profiles from it.</strong> Steward has no ad network integration of any
          kind.
        </p>
      </Section>

      <Section n={3} title="AI Processing">
        <p style={p}>
          Steward&rsquo;s chat, onboarding interview, and personalized content (daily verse selection aside, which is
          deterministic and not AI-generated) are powered by OpenAI&rsquo;s API. When you use these features, relevant context
          &mdash; such as your open tasks, recent journal entries, today&rsquo;s Pulse Check, this week&rsquo;s Sphere
          check-in, and your chat history &mdash; is sent to OpenAI to generate a response.
        </p>
        <p style={p}>
          OpenAI processes this as an API customer request. As of this Policy&rsquo;s effective date, OpenAI&rsquo;s API
          business terms state that API inputs and outputs are not used to train their models. If that ever changes in a way
          that affects Steward, we&rsquo;ll update this Policy.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          We do not send your data to any AI provider other than OpenAI, and we do not use your content to train our own
          models.
        </p>
      </Section>

      <Section n={4} title="Who We Share Information With">
        <p style={p}><strong style={{ color: C.parchment }}>We do not sell your personal information, and we never have.</strong> Steward
          is not an advertising business, and your journal entries, relationships, and conversations are not a product we sell
          to anyone.</p>
        <p style={p}>We share information only with the service providers that make Steward work, each of whom is only
          authorized to use it to provide their service to us:</p>
        <ul style={ul}>
          <li style={li}><strong style={{ color: C.parchment }}>OpenAI</strong> &mdash; AI chat, onboarding interview, and
            generated content (see Section 3)</li>
          <li style={li}><strong style={{ color: C.parchment }}>Google / Microsoft</strong> &mdash; sign-in, and, if you
            connect it, read-only Google Calendar access</li>
          <li style={li}><strong style={{ color: C.parchment }}>Resend</strong> &mdash; delivery of login-code and reminder
            emails</li>
          <li style={li}><strong style={{ color: C.parchment }}>Stripe</strong> &mdash; payment processing, once subscriptions
            launch</li>
          <li style={li}><strong style={{ color: C.parchment }}>Our hosting and database infrastructure</strong> &mdash; to run
            the App and store your data securely</li>
        </ul>
        <p style={{ ...p, marginBottom: 0 }}>
          We may also disclose information if reasonably necessary to comply with the law or valid legal process, protect the
          security of the App, investigate fraud, or protect the rights and safety of Lucas Align or our users &mdash; or as
          part of a merger, acquisition, or sale of assets, in which case any successor would remain bound by this Policy for
          information it receives.
        </p>
      </Section>

      <Section n={5} title="Data Retention">
        <p style={p}>
          We keep your information for as long as your account is active, so Steward can keep working the way it&rsquo;s
          supposed to &mdash; showing your history, trends, and past intentions back to you.
        </p>
        <p style={p}>
          Some items (relationships, jobs, pursuits, custom verses) have their own in-app delete or &ldquo;close&rdquo;
          controls; where a soft-delete exists, that data is kept (so it can be reopened) until you take the separate,
          confirmed &ldquo;permanent delete&rdquo; action, or until your account is deleted entirely.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          Backup copies of the database may persist for a limited time after deletion until they are naturally overwritten by
          our normal backup cycle.
        </p>
      </Section>

      <Section n={6} title="Account Deletion">
        <p style={p}>
          Steward doesn&rsquo;t yet have a self-serve &ldquo;delete my account&rdquo; button in the app &mdash; it&rsquo;s
          planned, alongside self-serve subscription cancellation.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          Until then, email <a href="mailto:admin@lucasalign.com" style={{ color: C.brassSoft }}>admin@lucasalign.com</a> from
          your account&rsquo;s email address and ask us to delete your account. We will delete your personal data &mdash;
          journal entries, intentions, relationships, commitments, chat history, and profile information &mdash; within{" "}
          <strong style={{ color: C.parchment }}>30 days</strong> of a verified request, other than what we&rsquo;re
          required to retain for legal, security, or accounting reasons (e.g., billing records once subscriptions exist).
        </p>
      </Section>

      <Section n={7} title="Your Choices">
        <ul style={{ ...ul, marginBottom: 0 }}>
          <li style={li}>Turn commitment reminder emails on or off, or change the address they&rsquo;re sent to, from Profile
            &rarr; Commitment Reminders</li>
          <li style={li}>Edit your onboarding answers any time from Profile &rarr; Edit My Answers, or redo the full interview</li>
          <li style={li}>Delete or reopen individual relationships, jobs, pursuits, and custom verses from within their
            respective tabs</li>
          <li style={li}>Disconnect Google Calendar at any time from the Calendar tab</li>
          <li style={li}>Request a full account deletion as described in Section 6</li>
        </ul>
      </Section>

      <Section n={8} title="California Privacy Rights (CCPA/CPRA)">
        <p style={p}>If you are a California resident, you have the right to:</p>
        <ul style={ul}>
          <li style={li}><strong style={{ color: C.parchment }}>Know</strong> what personal information we&rsquo;ve collected,
            used, and disclosed about you, and our sources and purposes for it (see Sections 1&ndash;4)</li>
          <li style={li}><strong style={{ color: C.parchment }}>Access</strong> a copy of that information</li>
          <li style={li}><strong style={{ color: C.parchment }}>Delete</strong> your personal information (Section 6)</li>
          <li style={li}><strong style={{ color: C.parchment }}>Correct</strong> inaccurate personal information</li>
          <li style={li}><strong style={{ color: C.parchment }}>Opt out of sale or sharing</strong> &mdash; not applicable, since
            we don&rsquo;t sell or share your information for cross-context advertising</li>
          <li style={li}>Not be discriminated against for exercising any of these rights</li>
        </ul>
        <p style={{ ...p, marginBottom: 0 }}>
          To exercise any of these rights, email <a href="mailto:admin@lucasalign.com" style={{ color: C.brassSoft }}>admin@lucasalign.com</a>{" "}
          from your account&rsquo;s email address. We&rsquo;ll verify your identity using your account email before acting on
          the request. You may also designate an authorized agent to submit a request on your behalf.
        </p>
      </Section>

      <Section n={9} title="Other U.S. State Privacy Rights">
        <p style={{ ...p, marginBottom: 0 }}>
          If you live in a state with its own comprehensive privacy law (for example Virginia, Colorado, Connecticut, or Utah),
          you generally have similar rights to know, access, correct, delete, and receive a copy of your personal information,
          and to appeal a denied request. Contact us at <a href="mailto:admin@lucasalign.com" style={{ color: C.brassSoft }}>admin@lucasalign.com</a> to
          exercise any of these rights &mdash; the process is the same as Section 8 above.
        </p>
      </Section>

      <Section n={10} title="Children's Privacy">
        <p style={p}>Steward is intended for users who are 18 or older. We do not knowingly collect information directly from
          children, and children should not create their own Steward accounts.</p>
        <p style={{ ...p, marginBottom: 0 }}>
          Because Steward helps adults track their family life, information about a user&rsquo;s own children may appear in
          the app &mdash; for example, as a relationship entry or in a journal note. That information is entered by the adult
          account holder about their own family, never collected by us directly from a child, and is treated with the same
          care as the rest of your personal content.
        </p>
      </Section>

      <Section n={11} title="Security">
        <p style={{ ...p, marginBottom: 0 }}>
          We use reasonable administrative, technical, and organizational safeguards to protect your information &mdash;
          including encrypted connections, access controls, and secure session handling. No method of transmission or storage
          is perfectly secure, and we can&rsquo;t guarantee absolute security. Please use a strong, unique password (or sign
          in with Google/Microsoft) and let us know right away at <a href="mailto:admin@lucasalign.com" style={{ color: C.brassSoft }}>admin@lucasalign.com</a> if
          you suspect unauthorized access to your account.
        </p>
      </Section>

      <Section n={12} title="International Users">
        <p style={{ ...p, marginBottom: 0 }}>
          Steward is currently operated for users in the United States and its data is stored in the United States. If that
          changes, we&rsquo;ll update this Policy to reflect any additional rights that apply to you.
        </p>
      </Section>

      <Section n={13} title="Changes to This Policy">
        <p style={{ ...p, marginBottom: 0 }}>
          We may update this Policy as Steward evolves or legal requirements change. The &ldquo;Last Updated&rdquo; date at
          the top reflects the most recent revision. If we make a material change, we&rsquo;ll let you know in the app or by
          email before it takes effect.
        </p>
      </Section>

      <Section n={14} title="Contact Us">
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
