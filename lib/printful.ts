import axios from 'axios'

export interface PrintfulProduct {
  id: number
  external_id: string
  name: string
  thumbnail: string
  is_ignored: boolean
  variant_count: number
  sync_product: {
    id: number
    external_id: string
    name: string
    synced: number
    thumbnail_url: string
    is_ignored: boolean
  }
}

export interface PrintfulVariant {
  id: number
  external_id: string
  sync_product_id: number
  name: string
  synced: number
  variant_id: number
  retail_price: string
  currency: string
  is_ignored: boolean
  sku: string
  product: {
    variant_id: number
    product_id: number
    image: string
    name: string
  }
}

export interface PrintfulOrder {
  external_id: string
  shipping: string
  recipient: {
    name: string
    address1: string
    city: string
    state_code: string
    country_code: string
    zip: string
    email?: string
  }
  items: Array<{
    sync_variant_id?: number
    external_variant_id?: string
    quantity: number
    retail_price?: string
  }>
}

class PrintfulService {
  private apiToken: string
  private storeId: string
  private baseURL = 'https://api.printful.com'
  private isDemoMode: boolean

  constructor() {
    this.apiToken = process.env.PRINTFUL_API_TOKEN || ''
    this.storeId = process.env.PRINTFUL_STORE_ID || ''
    this.isDemoMode = this.apiToken === 'demo'
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any) {
    // Demo mode - return mock data
    if (this.isDemoMode) {
      return this.getMockData(endpoint, method, data)
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          'X-PF-Store-Id': this.storeId
        },
        data
      })

      return response.data
    } catch (error: any) {
      throw new Error(`Printful API Error: ${error.response?.data?.error?.message || error.message}`)
    }
  }

  private getMockData(endpoint: string, method: string, data?: any) {
    // Mock responses for demo mode
    if (endpoint === '/store/products' && method === 'GET') {
      return {
        code: 200,
        result: [
          {
            id: 1,
            external_id: 'mock-hoodie-1',
            name: '999 Club Hoodie',
            thumbnail: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=300',
            variant_count: 3,
            sync_product: {
              id: 1,
              external_id: 'mock-hoodie-1',
              name: '999 Club Hoodie',
              synced: 1,
              thumbnail_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=300'
            }
          },
          {
            id: 2,
            external_id: 'mock-tshirt-1',
            name: 'Legends Never Die Tee',
            thumbnail: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300',
            variant_count: 5,
            sync_product: {
              id: 2,
              external_id: 'mock-tshirt-1',
              name: 'Legends Never Die Tee',
              synced: 1,
              thumbnail_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300'
            }
          }
        ]
      }
    }

    if (endpoint.startsWith('/store/products/') && method === 'GET') {
      return {
        code: 200,
        result: {
          sync_product: {
            id: 1,
            name: '999 Club Hoodie',
            thumbnail_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=300'
          },
          sync_variants: [
            {
              id: 1,
              name: '999 Club Hoodie - Black / S',
              retail_price: '45.00',
              currency: 'USD',
              sku: '999-HOODIE-BLACK-S',
              variant_id: 4012,
              product: {
                name: 'Unisex Heavy Blend Hooded Sweatshirt'
              }
            },
            {
              id: 2,
              name: '999 Club Hoodie - Black / M',
              retail_price: '45.00',
              currency: 'USD',
              sku: '999-HOODIE-BLACK-M',
              variant_id: 4013,
              product: {
                name: 'Unisex Heavy Blend Hooded Sweatshirt'
              }
            }
          ]
        }
      }
    }

    if (endpoint === '/orders' && method === 'POST') {
      return {
        code: 200,
        result: {
          id: Date.now(),
          external_id: data?.external_id || `order-${Date.now()}`,
          status: 'draft',
          shipping: 'STANDARD',
          created: new Date().toISOString(),
          recipient: data?.recipient,
          items: data?.items || []
        }
      }
    }

    return { code: 200, result: {} }
  }

  // Get all products from Printful store
  async getProducts(): Promise<PrintfulProduct[]> {
    const response = await this.makeRequest('/store/products')
    return response.result || []
  }

  // Get product details with variants
  async getProduct(productId: string): Promise<any> {
    const response = await this.makeRequest(`/store/products/${productId}`)
    return response.result
  }

  // Create order in Printful
  async createOrder(order: PrintfulOrder): Promise<any> {
    const response = await this.makeRequest('/orders', 'POST', order)
    return response.result
  }

  // Confirm order for production
  async confirmOrder(orderId: string): Promise<any> {
    const response = await this.makeRequest(`/orders/${orderId}/confirm`, 'POST')
    return response.result
  }

  // Get order status
  async getOrderStatus(orderId: string): Promise<any> {
    const response = await this.makeRequest(`/orders/${orderId}`)
    return response.result
  }

  // Sync product to store
  async syncProduct(productData: any): Promise<any> {
    const response = await this.makeRequest('/store/products', 'POST', productData)
    return response.result
  }

  // Get available catalog products (for creating new designs)
  async getCatalogProducts(): Promise<any> {
    const response = await this.makeRequest('/products')
    return response.result
  }

  // Generate mockup for product
  async generateMockup(productId: number, variantIds: number[], files: any[]): Promise<any> {
    const mockupData = {
      variant_ids: variantIds,
      format: 'jpg',
      files: files
    }

    const response = await this.makeRequest(`/mockup-generator/create-task/${productId}`, 'POST', mockupData)
    return response.result
  }
}

export const printfulService = new PrintfulService()
export default printfulService