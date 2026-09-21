import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`
      }
    })
    const text = await res.text()
    return NextResponse.json({ ok: true, status: res.status, body: text.slice(0, 500) })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error && (error as any).cause ? String((error as any).cause) : undefined
    })
  }
}
