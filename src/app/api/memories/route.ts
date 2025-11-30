import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { z } from 'zod'

const memorySchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  memory: z.string().min(1, 'Memory is required'),
  favoriteSong: z.string().optional(),
  memoryType: z.enum(['general', 'concert', 'personal', 'tribute']).default('general'),
  isAnonymous: z.boolean().default(false)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = memorySchema.parse(body)

    // If not anonymous, name is required
    if (!data.isAnonymous && !data.name) {
      return NextResponse.json(
        { error: 'Name is required when not submitting anonymously' },
        { status: 400 }
      )
    }

    // Create memory
    const memory = await prisma.memory.create({
      data: {
        name: data.isAnonymous ? null : data.name,
        location: data.isAnonymous ? null : data.location,
        memory: data.memory,
        favoriteSong: data.favoriteSong,
        memoryType: data.memoryType,
        isAnonymous: data.isAnonymous
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Memory shared successfully',
      id: memory.id
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Memory submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get approved memories for public display
    const memories = await prisma.memory.findMany({
      where: {
        isApproved: true
      },
      select: {
        id: true,
        name: true,
        location: true,
        memory: true,
        favoriteSong: true,
        memoryType: true,
        isAnonymous: true,
        isFeatured: true,
        createdAt: true
      },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 100
    })

    const stats = await prisma.memory.aggregate({
      _count: {
        id: true
      },
      where: {
        isApproved: true
      }
    })

    const typeStats = await prisma.memory.groupBy({
      by: ['memoryType'],
      _count: {
        memoryType: true
      },
      where: {
        isApproved: true
      }
    })

    return NextResponse.json({
      memories,
      stats: {
        total: stats._count.id,
        byType: typeStats.reduce((acc, item) => {
          acc[item.memoryType] = item._count.memoryType
          return acc
        }, {} as Record<string, number>)
      }
    })
  } catch (error) {
    console.error('Memories fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}