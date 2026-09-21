import LegalPageLayout from '@/components/LegalPageLayout'

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="September 21, 2026">
      <p>
        This policy explains what information Juice Junkies (juicejunkies.shop) collects, how we
        use it, and who we share it with.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Contact and shipping details you provide at checkout (name, email, address, phone)</li>
        <li>Order history and the products you purchase</li>
        <li>Content you choose to submit, such as testimonials, fan art, or memorial-wall posts</li>
        <li>Your email if you sign up for our newsletter or early-access list</li>
        <li>Basic technical data (like IP address) automatically collected by our hosting and security providers</li>
      </ul>
      <p>
        We do not collect or store your full payment card number — that&apos;s handled directly by
        Stripe (see below).
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To process, fulfill, and ship your orders</li>
        <li>To send order confirmations and shipping updates</li>
        <li>To respond to support requests</li>
        <li>To review and publish user-submitted content (with your consent)</li>
        <li>To send newsletter or early-access emails, only if you signed up for them</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We share the minimum information necessary with the following service providers:</p>
      <ul>
        <li><strong>Stripe</strong> — payment processing</li>
        <li><strong>Printful</strong> — order printing, packing, and shipping</li>
        <li><strong>Resend</strong> — sending order confirmation emails</li>
      </ul>
      <p>We do not sell your personal information to third parties.</p>

      <h2>Cookies</h2>
      <p>
        We use essential cookies to keep your shopping cart and admin login working. We don&apos;t
        currently use third-party advertising or analytics tracking cookies.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us to access, correct, or delete the personal information we hold about you
        by emailing <a href="mailto:support@juicejunkies.shop">support@juicejunkies.shop</a>. We&apos;ll
        respond within a reasonable time, though we may need to retain order records for tax and
        accounting purposes.
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        Our site is not directed at children under 13, and we do not knowingly collect personal
        information from them.
      </p>

      <h2>Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect your information, but
        no method of transmission or storage is 100% secure.
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy from time to time; the &quot;last updated&quot; date above will reflect the latest revision.</p>

      <h2>Contact us</h2>
      <p>
        Questions about this policy? Email us at{' '}
        <a href="mailto:support@juicejunkies.shop">support@juicejunkies.shop</a>.
      </p>
    </LegalPageLayout>
  )
}
