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
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Juice Junkies <orders@juicejunkies.shop>',
      to: data.customerEmail,
      subject: `Order Confirmed - #${data.orderId.slice(-8).toUpperCase()}`,
      html
    })
    return { sent: true }
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Unknown error' }
  }
}
