import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { isApproved, isFeatured } = body

    const updateData: any = {}
    if (typeof isApproved === 'boolean') updateData.isApproved = isApproved
    if (typeof isFeatured === 'boolean') updateData.isFeatured = isFeatured

    const memory = await prisma.memory.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      memory: memory
    })

  } catch (error) {
    console.error('Memory update error:', error)
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 }
    )
  }
}