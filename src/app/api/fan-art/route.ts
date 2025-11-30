import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { z } from 'zod'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const fanArtSchema = z.object({
  artistName: z.string().min(1, 'Artist name is required'),
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['digital', 'painting', 'design', 'photo']),
  description: z.string().optional(),
  socialHandle: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Parse form data
    const data = fanArtSchema.parse({
      artistName: formData.get('artistName'),
      title: formData.get('title'),
      type: formData.get('type'),
      description: formData.get('description'),
      socialHandle: formData.get('socialHandle')
    })

    // Generate unique filename
    const fileExtension = path.extname(file.name)
    const fileName = `${uuidv4()}${fileExtension}`

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'fan-art')
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    // Save file
    const filePath = path.join(uploadDir, fileName)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Save to database
    const fanArt = await prisma.fanArt.create({
      data: {
        artistName: data.artistName,
        title: data.title,
        type: data.type,
        description: data.description,
        socialHandle: data.socialHandle,
        fileName: fileName,
        fileSize: file.size,
        mimeType: file.type
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Fan art submitted successfully',
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
        likes: true,
        isFeatured: true,
        createdAt: true
      },
      orderBy: [
        { isFeatured: 'desc' },
        { likes: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 50
    })

    const stats = await prisma.fanArt.aggregate({
      _count: { id: true },
      _sum: { likes: true },
      where: { isApproved: true }
    })

    const typeStats = await prisma.fanArt.groupBy({
      by: ['type'],
      _count: { type: true },
      where: { isApproved: true }
    })

    return NextResponse.json({
      fanArt: fanArt.map(art => ({
        ...art,
        imageUrl: `/uploads/fan-art/${art.fileName}`
      })),
      stats: {
        total: stats._count.id,
        totalLikes: stats._sum.likes || 0,
        byType: typeStats.reduce((acc, item) => {
          acc[item.type] = item._count.type
          return acc
        }, {} as Record<string, number>)
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

// Handle likes
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const action = searchParams.get('action')

    if (!id || action !== 'like') {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    const fanArt = await prisma.fanArt.update({
      where: { id },
      data: {
        likes: {
          increment: 1
        }
      },
      select: {
        likes: true
      }
    })

    return NextResponse.json({
      success: true,
      likes: fanArt.likes
    })

  } catch (error) {
    console.error('Fan art like error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}