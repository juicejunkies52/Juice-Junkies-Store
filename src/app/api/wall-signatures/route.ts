import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

// Not exhaustive -- just enough to stop the most obvious abuse on a
// public, unmoderated input. Case-insensitive substring match.
const BLOCKED_WORDS = ['fuck', 'shit', 'nigger', 'nigga', 'faggot', 'cunt', 'retard', 'rape', 'kys']

function containsBlockedWord(text: string) {
  const lower = text.toLowerCase()
  return BLOCKED_WORDS.some((w) => lower.includes(w))
}

export async function GET() {
  const signatures = await prisma.wallSignature.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { id: true, name: true, x: true, y: true, color: true }
  })
  return NextResponse.json({ signatures })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 24) : ''
  const x = typeof body.x === 'number' && Number.isFinite(body.x) ? Math.max(0, Math.min(100, body.x)) : null
  const y = typeof body.y === 'number' && Number.isFinite(body.y) ? Math.max(0, Math.min(100, body.y)) : null
  const color = typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : '#39ff14'

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (x === null || y === null) {
    return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
  }
  if (containsBlockedWord(name)) {
    return NextResponse.json({ error: 'That name is not allowed' }, { status: 400 })
  }

  const signature = await prisma.wallSignature.create({
    data: { name, x, y, color },
    select: { id: true, name: true, x: true, y: true, color: true }
  })

  return NextResponse.json({ signature })
}
