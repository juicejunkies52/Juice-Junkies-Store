'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Edit3,
  Trash2,
  Package,
  DollarSign,
  Eye,
  Search,
  Filter,
  MoreVertical
} from 'lucide-react'
import AddProductModal from '../../../components/admin/AddProductModal'

interface Product {
  id: string
  name: string
  description?: string
  price: number
  compareAtPrice?: number
  images: string[]
  inventoryQty: number
  sku?: string
  tags: string[]
  status: string
  category?: {
    name: string
  }
  createdAt: string
  updatedAt: string
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/admin/products')
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'draft': return 'bg-yellow-500'
      case 'archived': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const ProductCard = ({ product }: { product: Product }) => (
    <motion.div
      className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 hover:border-accent/50 transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      {/* Product Image */}
      <div className="relative mb-4">
        <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden">
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-gray-600" />
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getStatusColor(product.status)}`} />

        {/* Quick Actions */}
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button className="bg-black/80 hover:bg-black/90 text-white p-1.5 rounded-lg transition-colors">
            <Eye className="w-4 h-4" />
          </button>
          <button className="bg-black/80 hover:bg-black/90 text-white p-1.5 rounded-lg transition-colors">
            <Edit3 className="w-4 h-4" />
          </button>
          <button className="bg-red-600/80 hover:bg-red-600/90 text-white p-1.5 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Product Info */}
      <div className="space-y-3">
        <div>
          <h3 className="text-white font-semibold text-lg line-clamp-2">{product.name}</h3>
          {product.category && (
            <p className="text-gray-400 text-sm">{product.category.name}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white font-bold">{formatPrice(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-gray-400 line-through text-sm">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center text-sm">
          <div className="text-gray-400">
            Stock: <span className={product.inventoryQty > 0 ? 'text-green-400' : 'text-red-400'}>
              {product.inventoryQty}
            </span>
          </div>
          {product.sku && (
            <div className="text-gray-400">SKU: {product.sku}</div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {product.tags.slice(0, 2).map((tag, index) => (
              <span key={index} className="bg-accent/20 text-accent text-xs px-2 py-1 rounded">
                {tag}
              </span>
            ))}
            {product.tags.length > 2 && (
              <span className="text-gray-400 text-xs">+{product.tags.length - 2}</span>
            )}
          </div>

          <span className={`px-2 py-1 rounded text-xs font-medium ${
            product.status === 'active' ? 'bg-green-500/20 text-green-400' :
            product.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {product.status}
          </span>
        </div>
      </div>
    </motion.div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black to-green-900/10" />
      </div>

      {/* Header */}
      <motion.header
        className="relative z-10 border-b border-gray-800 bg-black/20 backdrop-blur-sm"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Product Management</h1>
              <p className="text-gray-400 mt-1">Manage your store inventory and products</p>
            </div>
            <motion.button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-5 h-5" />
              Add Product
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Filters and Search */}
        <motion.div
          className="mb-8 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors w-full md:w-64"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-12 pr-8 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:border-accent focus:outline-none transition-colors appearance-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="text-gray-400 text-sm">
            {filteredProducts.length} of {products.length} products
          </div>
        </motion.div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No products found</h3>
            <p className="text-gray-400 mb-4">
              {products.length === 0
                ? "Get started by adding your first product."
                : "Try adjusting your search or filter criteria."
              }
            </p>
            <motion.button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white px-6 py-3 rounded-lg font-semibold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Add Your First Product
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onProductAdded={fetchProducts}
      />
    </div>
  )
}