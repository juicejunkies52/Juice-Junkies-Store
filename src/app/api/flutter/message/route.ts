import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

const BLOCKED_WORDS = ['fuck', 'shit', 'nigger', 'nigga', 'faggot', 'cunt', 'retard', 'rape', 'kys']

function containsBlockedWord(text: string) {
  const lower = text.toLowerCase()
  return BLOCKED_WORDS.some((w) => lower.includes(w))
}

// Only whoever currently holds the global #1 score can set the message
// everyone sees -- re-checked server-side on every write, not just when
// they first took the top spot, so the message always belongs to whoever
// actually holds #1 right now.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (!message || message.length > 100) {
    return NextResponse.json({ error: 'Message must be 1-100 characters' }, { status: 400 })
  }
  if (containsBlockedWord(message)) {
    return NextResponse.json({ error: 'Message not allowed' }, { status: 400 })
  }

  const top = await prisma.flutterScore.findFirst({ orderBy: { score: 'desc' } })
  if (!top || top.userId !== user.id) {
    return NextResponse.json({ error: 'Only the current #1 top scorer can set the message' }, { status: 403 })
  }

  await prisma.flutterScore.update({ where: { userId: user.id }, data: { message } })

  return NextResponse.json({ success: true, message })
}
