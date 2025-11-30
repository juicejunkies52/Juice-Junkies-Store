import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                fulfillmentType: true
              }
            },
            variant: {
              select: {
                id: true,
                size: true,
                color: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      order: order
    })

  } catch (error) {
    console.error('Order fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, fulfillmentStatus, trackingNumber, trackingUrl } = body

    const updateData: any = {}
    if (status) updateData.status = status
    if (fulfillmentStatus) updateData.fulfillmentStatus = fulfillmentStatus
    if (trackingNumber) updateData.trackingNumber = trackingNumber
    if (trackingUrl) updateData.trackingUrl = trackingUrl

    const order = await prisma.order.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      order: order
    })

  } catch (error) {
    console.error('Order update error:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}