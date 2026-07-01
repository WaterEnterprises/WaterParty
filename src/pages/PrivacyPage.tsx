import { Shield, ArrowLeft, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-base text-text-bright font-sans overflow-y-auto box-border pt-[var(--safe-area-inset-top,env(safe-area-inset-top,0px))]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-base/95 backdrop-blur-xl border-b border-border-default">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-glass border border-border-default flex items-center justify-center hover:bg-glass-hover transition-colors active:scale-95"
          >
            <ArrowLeft size={18} className="text-text-secondary" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-accent/15 flex items-center justify-center">
              <Shield size={16} className="text-brand-accent" />
            </div>
            <div>
              <h1 className="text-sm font-black text-text-primary uppercase tracking-widest">Privacy Policy</h1>
              <p className="text-micro font-bold text-text-faint uppercase tracking-wider">Last updated: June 2026</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* 1. Introduction */}
        <Section title="1. Introduction">
          <p className="text-sm leading-relaxed text-text-secondary">
            WaterParty ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
            explains how we collect, use, disclose, and safeguard your information when you use our mobile 
            application and associated services (collectively, the "App").
          </p>
          <p className="text-sm leading-relaxed text-text-secondary mt-3">
            By using the App, you agree to the collection and use of information in accordance with this policy.
            If you do not agree with the terms of this Privacy Policy, please do not access the App.
          </p>
        </Section>

        {/* 2. Information We Collect */}
        <Section title="2. Information We Collect">
          <p className="text-sm leading-relaxed text-text-secondary mb-3">
            We collect the following types of information when you use our App:
          </p>
          <ul className="space-y-3">
            <ListItem title="Personal Information">
              When you register and create a profile, we collect your name, email address, phone number, 
              date of birth, gender, profile photos, and any other information you choose to add to your 
              profile (such as bio, job title, company, education, and social media handles).
            </ListItem>
            <ListItem title="Location Data">
              With your permission, we collect precise geolocation data to show you parties and events 
              near your location. You can disable location access at any time through your device settings.
            </ListItem>
            <ListItem title="Usage Data">
              We automatically collect information about how you interact with the App, including the 
              parties you view, swipe on, register for, and messages you send within chat rooms.
            </ListItem>
            <ListItem title="Payment Information">
              If you contribute to a crowdfund or receive payouts, payment processing is handled by 
              Stripe, Inc. We do not store your full payment card details on our servers. Stripe's 
              Privacy Policy applies to the information you provide during payment processing.
            </ListItem>
            <ListItem title="Device Information">
              We may collect device-specific information such as your device model, operating system 
              version, and unique device identifiers for analytics and troubleshooting.
            </ListItem>
          </ul>
        </Section>

        {/* 3. How We Use Your Information */}
        <Section title="3. How We Use Your Information">
          <p className="text-sm leading-relaxed text-text-secondary mb-3">We use the collected information to:</p>
          <ul className="space-y-2">
            <BulletPoint>Provide, operate, and maintain the App</BulletPoint>
            <BulletPoint>Match you with events and other users based on your preferences and location</BulletPoint>
            <BulletPoint>Facilitate communication between users through chat functionality</BulletPoint>
            <BulletPoint>Process crowdfund contributions and payouts via Stripe</BulletPoint>
            <BulletPoint>Send you notifications about parties, messages, and updates</BulletPoint>
            <BulletPoint>Detect, prevent, and address fraud, abuse, or violations of our Terms of Service</BulletPoint>
            <BulletPoint>Improve the App through analytics and user feedback</BulletPoint>
            <BulletPoint>Comply with legal obligations</BulletPoint>
          </ul>
        </Section>

        {/* 4. Information Sharing */}
        <Section title="4. Information Sharing">
          <p className="text-sm leading-relaxed text-text-secondary mb-3">
            We do not sell your personal information. We may share your information in the following circumstances:
          </p>
          <ul className="space-y-2">
            <BulletPoint>
              <strong>With other users:</strong> Your profile information (name, photos, bio, social handles) 
              is visible to other users of the App as part of the social experience.
            </BulletPoint>
            <BulletPoint>
              <strong>With service providers:</strong> We engage third-party service providers who perform 
              services on our behalf, such as Stripe (payment processing), Turso (database hosting), 
              and Render (cloud hosting).
            </BulletPoint>
            <BulletPoint>
              <strong>For legal reasons:</strong> We may disclose your information if required to do so by 
              law or in response to valid legal requests by public authorities.
            </BulletPoint>
            <BulletPoint>
              <strong>With your consent:</strong> We may share your information for any other purpose with 
              your explicit consent.
            </BulletPoint>
          </ul>
        </Section>

        {/* 5. Data Security */}
        <Section title="5. Data Security">
          <p className="text-sm leading-relaxed text-text-secondary">
            We implement appropriate technical and organizational security measures to protect your 
            personal information, including encryption in transit (TLS/SSL) and at rest, secure 
            session management, and regular security audits. However, no method of transmission 
            over the Internet or electronic storage is 100% secure, and we cannot guarantee 
            absolute security.
          </p>
        </Section>

        {/* 6. Data Retention */}
        <Section title="6. Data Retention">
          <p className="text-sm leading-relaxed text-text-secondary">
            We retain your personal information for as long as your account is active or as needed 
            to provide you services. If you delete your account, we will delete or anonymize your 
            personal information within 30 days, except where we are required to retain it for 
            legal or regulatory compliance purposes.
          </p>
        </Section>

        {/* 7. Your Rights */}
        <Section title="7. Your Rights">
          <p className="text-sm leading-relaxed text-text-secondary mb-3">
            Depending on your jurisdiction, you may have the following rights regarding your 
            personal information:
          </p>
          <ul className="space-y-2">
            <BulletPoint>Access, update, or delete your personal information through your profile settings</BulletPoint>
            <BulletPoint>Withdraw consent for location tracking at any time via device settings</BulletPoint>
            <BulletPoint>Request a copy of the data we hold about you</BulletPoint>
            <BulletPoint>Object to or restrict processing of your data</BulletPoint>
            <BulletPoint>Request portability of your data to another service provider</BulletPoint>
          </ul>
        </Section>

        {/* 8. Children's Privacy */}
        <Section title="8. Children's Privacy">
          <p className="text-sm leading-relaxed text-text-secondary">
            The App is not intended for individuals under the age of 18. We do not knowingly 
            collect personal information from children. If we become aware that a child has 
            provided us with personal information, we will take steps to delete such information 
            promptly. If you believe we might have any information from or about a child, please 
            contact us immediately.
          </p>
        </Section>

        {/* 9. Third-Party Services */}
        <Section title="9. Third-Party Services">
          <p className="text-sm leading-relaxed text-text-secondary mb-3">
            The App integrates with the following third-party services:
          </p>
          <ul className="space-y-2">
            <BulletPoint>
              <strong>Stripe</strong> — Payment processing for crowdfund contributions and payouts.
              See Stripe's Privacy Policy at <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-accent underline">stripe.com/privacy</a>.
            </BulletPoint>
            <BulletPoint>
              <strong>Turso</strong> — Database storage. See Turso's Privacy Policy at their website.
            </BulletPoint>
            <BulletPoint>
              <strong>Render</strong> — Cloud hosting. See Render's Privacy Policy at their website.
            </BulletPoint>
          </ul>
        </Section>

        {/* 10. Changes to This Policy */}
        <Section title="10. Changes to This Policy">
          <p className="text-sm leading-relaxed text-text-secondary">
            We may update this Privacy Policy from time to time. We will notify you of any changes 
            by posting the new Privacy Policy on this page and updating the "Last updated" date. 
            You are advised to review this Privacy Policy periodically for any changes.
          </p>
        </Section>

        {/* 11. Contact Us */}
        <Section title="11. Contact Us">
          <p className="text-sm leading-relaxed text-text-secondary mb-4">
            If you have any questions, concerns, or requests regarding this Privacy Policy, please 
            contact us:
          </p>
          <div className="flex items-center gap-3 bg-card border border-border-default rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl bg-brand-accent/15 flex items-center justify-center shrink-0">
              <Mail size={18} className="text-brand-accent" />
            </div>
            <div>
              <p className="text-nano font-black text-text-faint uppercase tracking-widest mb-0.5">Email</p>
              <a href="mailto:privacy@waterparty.app" className="text-sm font-bold text-brand-accent hover:underline">
                privacy@waterparty.app
              </a>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center pb-12">
          <p className="text-nano font-bold text-text-faint uppercase tracking-widest">
            WaterParty &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-black text-text-primary tracking-widest uppercase mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-brand-accent rounded-full inline-block" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function ListItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="bg-card/50 border border-border-default rounded-xl p-3.5">
      <h4 className="text-tiny font-black text-brand-accent uppercase tracking-wider mb-1">{title}</h4>
      <p className="text-xs leading-relaxed text-text-secondary">{children}</p>
    </li>
  );
}

function BulletPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-xs leading-relaxed text-text-secondary">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-accent/60 mt-1.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
