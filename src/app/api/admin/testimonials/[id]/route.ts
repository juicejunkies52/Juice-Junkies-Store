import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { isApproved, isFeatured, allowPublic } = body

    const updateData: any = {}
    if (typeof isApproved === 'boolean') updateData.isApproved = isApproved
    if (typeof isFeatured === 'boolean') updateData.isFeatured = isFeatured
    if (typeof allowPublic === 'boolean') updateData.allowPublic = allowPublic

    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      testimonial: testimonial
    })

  } catch (error) {
    console.error('Testimonial update error:', error)
    return NextResponse.json(
      { error: 'Failed to update testimonial' },
      { status: 500 }
    )
  }
}