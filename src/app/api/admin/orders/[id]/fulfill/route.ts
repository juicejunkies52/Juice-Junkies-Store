import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { printfulService } from '../../../../../../../lib/printful'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get order with items and products
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            variant: true
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

    if (order.fulfillmentStatus !== 'unfulfilled') {
      return NextResponse.json(
        { error: 'Order is already fulfilled or in progress' },
        { status: 400 }
      )
    }

    // Parse shipping address
    const shippingAddress = JSON.parse(order.shippingAddress)

    // Check if order has print-on-demand items
    const printfulItems = order.items.filter(item =>
      item.product.fulfillmentType === 'printful'
    )

    if (printfulItems.length === 0) {
      return NextResponse.json(
        { error: 'No print-on-demand items in this order' },
        { status: 400 }
      )
    }

    // Prepare Printful order data
    const printfulOrderData = {
      external_id: order.id,
      shipping: 'STANDARD',
      recipient: {
        name: shippingAddress.name,
        address1: shippingAddress.address,
        city: shippingAddress.city,
        state_code: shippingAddress.state,
        country_code: shippingAddress.country || 'US',
        zip: shippingAddress.zipCode,
        email: shippingAddress.email
      },
      items: printfulItems.map(item => ({
        external_variant_id: item.product.printfulExtId || item.product.id,
        quantity: item.quantity,
        retail_price: item.price.toString()
      }))
    }

    // Create order in Printful
    const printfulOrder = await printfulService.createOrder(printfulOrderData)

    // Update order status in database
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        fulfillmentStatus: 'pending',
        printfulOrderId: printfulOrder.id?.toString(),
        updatedAt: new Date()
      }
    })

    // If not in demo mode, confirm the order for production
    if (process.env.PRINTFUL_API_TOKEN !== 'demo') {
      try {
        await printfulService.confirmOrder(printfulOrder.id.toString())

        await prisma.order.update({
          where: { id },
          data: {
            fulfillmentStatus: 'fulfilled',
            updatedAt: new Date()
          }
        })
      } catch (confirmError) {
        console.error('Error confirming Printful order:', confirmError)
        // Order is created but not confirmed - can be manually confirmed later
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order sent to Printful for fulfillment',
      order: updatedOrder,
      printfulOrder: printfulOrder,
      itemCount: printfulItems.length
    })

  } catch (error) {
    console.error('Order fulfillment error:', error)
    return NextResponse.json(
      { error: 'Failed to fulfill order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}