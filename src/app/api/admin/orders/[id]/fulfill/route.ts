import { NextRequest, NextResponse } from 'next/server'
import { fulfillPrintfulOrder, OrderNotFoundError } from '../../../../../../../lib/fulfillOrder'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await fulfillPrintfulOrder(id)

    if (result.skipped) {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Order sent to Printful for fulfillment',
      printfulOrder: result.printfulOrder,
      itemCount: result.itemCount
    })

  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    console.error('Order fulfillment error:', error)
    return NextResponse.json(
      { error: 'Failed to fulfill order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
