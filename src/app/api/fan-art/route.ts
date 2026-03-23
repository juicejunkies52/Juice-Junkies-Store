import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { z } from 'zod'

const fanArtSchema = z.object({
  artistName: z.string().min(1, 'Artist name is required'),
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['digital', 'painting', 'design', 'photo']),
  description: z.string().optional(),
  socialHandle: z.string().optional(),
  fileName: z.string().min(1, 'File is required'),
  fileSize: z.number().positive('File size must be positive'),
  mimeType: z.string().min(1, 'File type is required')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = fanArtSchema.parse(body)

    // Create fan art submission
    const fanArt = await prisma.fanArt.create({
      data: {
        artistName: data.artistName,
        title: data.title,
        type: data.type,
        description: data.description,
        socialHandle: data.socialHandle,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        isApproved: false, // Requires admin approval
        isFeatured: false,
        likes: 0
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Fan art submitted successfully! It will be reviewed before appearing on the site.',
      id: fanArt.id
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Fan art submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get approved fan art for public display
    const fanArt = await prisma.fanArt.findMany({
      where: {
        isApproved: true
      },
      select: {
        id: true,
        artistName: true,
        title: true,
        type: true,
        description: true,
        socialHandle: true,
        fileName: true,
        mimeType: true,
        isFeatured: true,
        likes: true,
        createdAt: true
      },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 50
    })

    const stats = await prisma.fanArt.aggregate({
      _count: { id: true },
      _sum: { likes: true },
      where: { isApproved: true }
    })

    return NextResponse.json({
      fanArt,
      stats: {
        total: stats._count.id,
        totalLikes: stats._sum.likes || 0
      }
    })
  } catch (error) {
    console.error('Fan art fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}