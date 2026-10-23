import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'

// Used by the admin product grid to toggle a product in/out of the
// homepage's Featured Products section and set its display order there.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data: {
      featured?: boolean
      featuredOrder?: number
      preOrderMode?: boolean
      preOrderDeposit?: number | null
      preOrderShipEstimate?: string | null
    } = {}

    if (typeof body.featured === 'boolean') data.featured = body.featured
    if (typeof body.featuredOrder === 'number') data.featuredOrder = body.featuredOrder
    if (typeof body.preOrderMode === 'boolean') data.preOrderMode = body.preOrderMode
    if (body.preOrderDeposit === null || typeof body.preOrderDeposit === 'number') data.preOrderDeposit = body.preOrderDeposit
    if (body.preOrderShipEstimate === null || typeof body.preOrderShipEstimate === 'string')
      data.preOrderShipEstimate = body.preOrderShipEstimate

    const product = await prisma.product.update({ where: { id }, data })
    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error('Product update error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Variants cascade-delete automatically (schema), but an order that
    // references this product directly would otherwise block the delete
    // with a raw FK error -- catch it early with a clearer message instead.
    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } })
    if (orderItemCount > 0) {
      return NextResponse.json(
        { error: 'This product has order history and can\'t be deleted. Archive it instead (set status to archived).' },
        { status: 409 }
      )
    }

    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Product delete error:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
