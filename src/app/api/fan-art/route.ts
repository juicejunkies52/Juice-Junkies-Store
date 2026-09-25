import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '../../../../lib/prisma'

const ALLOWED_TYPES = ['digital', 'painting', 'design', 'photo']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    // The submission form sends multipart/form-data (it includes the actual
    // image file), not JSON.
    const formData = await request.formData()

    const artistName = formData.get('artistName')?.toString().trim()
    const title = formData.get('title')?.toString().trim()
    const type = formData.get('type')?.toString()
    const description = formData.get('description')?.toString() || undefined
    const socialHandle = formData.get('socialHandle')?.toString() || undefined
    const file = formData.get('file')

    if (!artistName || !title) {
      return NextResponse.json(
        { error: 'Artist name and title are required' },
        { status: 400 }
      )
    }

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid art type' },
        { status: 400 }
      )
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File must be under 10MB' },
        { status: 400 }
      )
    }

    const blob = await put(`fan-art/${Date.now()}-${file.name}`, file, {
      access: 'public'
    })

    const fanArt = await prisma.fanArt.create({
      data: {
        artistName,
        title,
        type,
        description,
        socialHandle,
        url: blob.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
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
        url: true,
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
