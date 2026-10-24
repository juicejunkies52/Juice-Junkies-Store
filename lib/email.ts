import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface OrderConfirmationItem {
  name: string
  quantity: number
  price: number
}

interface OrderConfirmationData {
  orderId: string
  customerEmail: string
  customerName?: string
  items: OrderConfirmationItem[]
  totalAmount: number
}

type SendResult = { sent: true } | { sent: false; reason: string }

export async function sendOrderConfirmationEmail(data: OrderConfirmationData): Promise<SendResult> {
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  if (!data.customerEmail) {
    return { sent: false, reason: 'Order has no customer email' }
  }

  const itemsHtml = data.items
    .map(
      item =>
        `<tr><td style="padding:8px 0;">${item.name} &times; ${item.quantity}</td><td style="padding:8px 0; text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td></tr>`
    )
    .join('')

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <h1 style="font-size: 20px;">Thanks for your order${data.customerName ? `, ${data.customerName}` : ''}!</h1>
      <p>Your Juice Junkies order <strong>#${data.orderId.slice(-8).toUpperCase()}</strong> is confirmed.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        ${itemsHtml}
        <tr>
          <td style="padding: 12px 0; border-top: 1px solid #ddd; font-weight: bold;">Total</td>
          <td style="padding: 12px 0; border-top: 1px solid #ddd; text-align: right; font-weight: bold;">$${data.totalAmount.toFixed(2)}</td>
        </tr>
      </table>
      <p>We'll send another email with tracking info once your order ships.</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">999 Forever &mdash; Juice Junkies</p>
    </div>
  `

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Juice Junkies <orders@juicejunkies.shop>',
      to: data.customerEmail,
      subject: `Order Confirmed - #${data.orderId.slice(-8).toUpperCase()}`,
      html
    })

    // The Resend SDK reports API errors (e.g. unverified sending domain) via
    // this `error` field rather than throwing.
    if (error) {
      return { sent: false, reason: error.message }
    }

    return { sent: true }
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Unknown error' }
  }
}

interface PreOrderReservedData {
  orderId: string
  customerEmail: string
  productName: string
  depositAmount: number
  balanceDue: number
  shipEstimate?: string
  shipByDate?: string
}

// Sent the instant a pre-order deposit clears -- deliberately distinct
// from sendOrderConfirmationEmail (this is a RESERVATION, not a completed
// sale; nothing has shipped, and the customer still owes the balance).
export async function sendPreOrderReservedEmail(data: PreOrderReservedData): Promise<SendResult> {
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }
  if (!data.customerEmail) {
    return { sent: false, reason: 'Order has no customer email' }
  }

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <h1 style="font-size: 20px;">You're in! ${data.productName} is reserved.</h1>
      <p>Your deposit of <strong>$${data.depositAmount.toFixed(2)}</strong> secured your spot for the official launch
      collection drop <strong>#${data.orderId.slice(-8).toUpperCase()}</strong>.</p>
      <p>Remaining balance: <strong>$${data.balanceDue.toFixed(2)}</strong> -- we'll email you a payment link for that
      once it's ready to ship${data.shipEstimate ? ` (${data.shipEstimate})` : ''}. Nothing more to do right now.</p>
      ${data.shipByDate ? `<p>Target ship date: <strong>${data.shipByDate}</strong>. If that changes for any reason, we'll email you -- you're never left wondering.</p>` : ''}
      <p style="color: #999; font-size: 12px; margin-top: 32px;">999 Forever &mdash; Juice Junkies</p>
    </div>
  `

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Juice Junkies <orders@juicejunkies.shop>',
      to: data.customerEmail,
      subject: `You're reserved - ${data.productName}`,
      html
    })
    if (error) {
      return { sent: false, reason: error.message }
    }
    return { sent: true }
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Unknown error' }
  }
}

interface PreOrderBalanceDueData {
  orderId: string
  customerEmail: string
  productName: string
  balanceAmount: number
  payUrl: string
}

// Admin-triggered once a reservation is ready to ship -- the payUrl
// carries a signed token (lib/preorderToken.ts) good for 180 days, no
// login required to use it.
export async function sendPreOrderBalanceDueEmail(data: PreOrderBalanceDueData): Promise<SendResult> {
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }
  if (!data.customerEmail) {
    return { sent: false, reason: 'Order has no customer email' }
  }

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <h1 style="font-size: 20px;">${data.productName} is almost ready!</h1>
      <p>Your pre-order <strong>#${data.orderId.slice(-8).toUpperCase()}</strong> is ready to ship. Pay the remaining
      balance below to lock in your spot in line.</p>
      <p style="font-size: 24px; font-weight: bold; margin: 24px 0;">$${data.balanceAmount.toFixed(2)}</p>
      <a href="${data.payUrl}" style="display:inline-block; background:#39ff14; color:#000; padding:14px 28px; border-radius:8px; font-weight:bold; text-decoration:none;">
        Pay Remaining Balance
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">999 Forever &mdash; Juice Junkies</p>
    </div>
  `

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Juice Junkies <orders@juicejunkies.shop>',
      to: data.customerEmail,
      subject: `Your pre-order is ready - pay the balance for ${data.productName}`,
      html
    })
    if (error) {
      return { sent: false, reason: error.message }
    }
    return { sent: true }
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Unknown error' }
  }
}

interface PreOrderCancelledData {
  orderId: string
  customerEmail: string
  productName: string
  refundAmount: number
}

// Admin-triggered when a reservation is cancelled -- always paired with an
// actual Stripe refund of the deposit (see /api/admin/preorder/cancel),
// never sent without the money having actually been returned.
export async function sendPreOrderCancelledEmail(data: PreOrderCancelledData): Promise<SendResult> {
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }
  if (!data.customerEmail) {
    return { sent: false, reason: 'Order has no customer email' }
  }

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <h1 style="font-size: 20px;">Your ${data.productName} reservation was cancelled</h1>
      <p>Pre-order <strong>#${data.orderId.slice(-8).toUpperCase()}</strong> has been cancelled and your deposit of
      <strong>$${data.refundAmount.toFixed(2)}</strong> has been refunded to your original payment method.</p>
      <p>Refunds typically take 5-10 business days to show up, depending on your bank. Sorry for the trouble --
      reach out if you have any questions.</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">999 Forever &mdash; Juice Junkies</p>
    </div>
  `

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Juice Junkies <orders@juicejunkies.shop>',
      to: data.customerEmail,
      subject: `Your pre-order was cancelled & refunded - ${data.productName}`,
      html
    })
    if (error) {
      return { sent: false, reason: error.message }
    }
    return { sent: true }
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Unknown error' }
  }
}

interface AdminOrderNotificationData {
  adminEmail: string
  orderId: string
  customerEmail: string
  items: OrderConfirmationItem[]
  totalAmount: number
}

export async function sendAdminOrderNotificationEmail(data: AdminOrderNotificationData): Promise<SendResult> {
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  const itemsHtml = data.items
    .map(
      item =>
        `<tr><td style="padding:8px 0;">${item.name} &times; ${item.quantity}</td><td style="padding:8px 0; text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td></tr>`
    )
    .join('')

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <h1 style="font-size: 20px;">New order: #${data.orderId.slice(-8).toUpperCase()}</h1>
      <p>From: ${data.customerEmail || 'no email provided'}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        ${itemsHtml}
        <tr>
          <td style="padding: 12px 0; border-top: 1px solid #ddd; font-weight: bold;">Total</td>
          <td style="padding: 12px 0; border-top: 1px solid #ddd; text-align: right; font-weight: bold;">$${data.totalAmount.toFixed(2)}</td>
        </tr>
      </table>
      <p>View and fulfill it in the <a href="https://www.juicejunkies.shop/admin/orders">admin dashboard</a>.</p>
    </div>
  `

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Juice Junkies <orders@juicejunkies.shop>',
      to: data.adminEmail,
      subject: `New order - #${data.orderId.slice(-8).toUpperCase()} ($${data.totalAmount.toFixed(2)})`,
      html
    })

    if (error) {
      return { sent: false, reason: error.message }
    }

    return { sent: true }
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Unknown error' }
  }
}
