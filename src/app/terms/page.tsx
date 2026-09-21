import Link from 'next/link'
import LegalPageLayout from '@/components/LegalPageLayout'

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" updated="September 21, 2026">
      <p>
        Welcome to Juice Junkies (juicejunkies.shop). By visiting our site or placing an order,
        you agree to the terms below. Please read them before you buy.
      </p>

      <h2>Who we are</h2>
      <p>
        Juice Junkies is an independent, fan-operated store selling Juice WRLD-inspired
        merchandise. We are not officially affiliated with, endorsed by, or operated on behalf of
        the estate of Jarad &quot;Juice WRLD&quot; Higgins, his label, or any rights holders.
      </p>

      <h2>Orders &amp; products</h2>
      <p>
        We make reasonable efforts to describe and display our products accurately, but colors,
        sizing, and print placement may vary slightly from photos. We reserve the right to limit,
        refuse, or cancel any order, including for suspected fraud, pricing errors, or inventory
        issues — if we cancel a paid order, you&apos;ll receive a full refund.
      </p>

      <h2>Payment</h2>
      <p>
        Payments are processed securely through Stripe. By placing an order, you authorize us to
        charge your chosen payment method for the full order total, including any applicable tax
        and shipping. We do not store your full card details.
      </p>

      <h2>Shipping &amp; fulfillment</h2>
      <p>
        Most orders are produced and shipped by our print-on-demand partner, Printful; some items
        are fulfilled by us directly. Delivery estimates are provided in good faith but are not
        guaranteed. Risk of loss passes to you once an order is handed to the carrier.
      </p>

      <h2>Returns &amp; refunds</h2>
      <p>
        See our <Link href="/returns">Return &amp; Refund Policy</Link> for details on damaged,
        defective, or incorrect items.
      </p>

      <h2>User-submitted content</h2>
      <p>
        If you submit a testimonial, fan art, memory, or other content to us, you confirm it&apos;s
        your own work (or you have permission to share it) and you grant us a non-exclusive right
        to display it on our site. Submissions are reviewed before publishing, and we may decline
        or remove any submission at our discretion.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The Juice Junkies name, logo, and original site content belong to us. Juice WRLD-related
        names, likenesses, and trademarks belong to their respective owners and are referenced
        here for fan-community purposes only.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Juice Junkies is not liable for indirect,
        incidental, or consequential damages arising from your use of this site or purchase of
        our products. Our total liability for any claim is limited to the amount you paid for the
        order in question.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of South Carolina, USA.</p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Continued use of the site after changes are
        posted means you accept the updated terms.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions? Email us at <a href="mailto:support@juicejunkies.shop">support@juicejunkies.shop</a>.
      </p>
    </LegalPageLayout>
  )
}
