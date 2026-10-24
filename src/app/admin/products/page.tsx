'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Edit3,
  Trash2,
  Package,
  DollarSign,
  Eye,
  Search,
  Filter,
  MoreVertical,
  Star,
  Clock,
  X
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
  featured: boolean
  featuredOrder: number
  preOrderMode: boolean
  preOrderDeposit: number | null
  preOrderShipEstimate: string | null
  preOrderShipBy: string | null
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
  const [bulkToggling, setBulkToggling] = useState(false)
  // Was window.prompt()/confirm() -- too easy to miss or dismiss by
  // accident, which read as the whole feature silently not working.
  // An in-page modal is visible and can't be mistaken for "nothing happened."
  const [bulkModalMode, setBulkModalMode] = useState<'enable' | 'disable' | null>(null)
  const [bulkDepositInput, setBulkDepositInput] = useState('5')
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number } | null>(null)

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

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Failed to delete product')
        return
      }
      setProducts(prev => prev.filter(p => p.id !== product.id))
    } catch (error) {
      console.error('Failed to delete product:', error)
      alert('Failed to delete product')
    }
  }

  const handleToggleFeatured = async (product: Product) => {
    const next = !product.featured
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, featured: next } : p))
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: next })
      })
      if (!response.ok) throw new Error('Failed')
    } catch (error) {
      console.error('Failed to update featured status:', error)
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, featured: !next } : p))
    }
  }

  const handleFeaturedOrderChange = async (product: Product, order: number) => {
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, featuredOrder: order } : p))
    try {
      await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featuredOrder: order })
      })
    } catch (error) {
      console.error('Failed to update featured order:', error)
    }
  }

  const handleTogglePreOrder = async (product: Product) => {
    const next = !product.preOrderMode
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, preOrderMode: next } : p))
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preOrderMode: next })
      })
      if (!response.ok) throw new Error('Failed')
    } catch (error) {
      console.error('Failed to update pre-order mode:', error)
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, preOrderMode: !next } : p))
    }
  }

  const handlePreOrderDepositChange = async (product: Product, deposit: number | null) => {
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, preOrderDeposit: deposit } : p))
    try {
      await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preOrderDeposit: deposit })
      })
    } catch (error) {
      console.error('Failed to update pre-order deposit:', error)
    }
  }

  const handlePreOrderShipEstimateChange = async (product: Product, estimate: string) => {
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, preOrderShipEstimate: estimate } : p))
    try {
      await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preOrderShipEstimate: estimate || null })
      })
    } catch (error) {
      console.error('Failed to update pre-order ship estimate:', error)
    }
  }

  const handlePreOrderShipByChange = async (product: Product, dateStr: string) => {
    const iso = dateStr ? new Date(dateStr).toISOString() : null
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, preOrderShipBy: iso } : p))
    try {
      await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preOrderShipBy: iso })
      })
    } catch (error) {
      console.error('Failed to update pre-order ship-by date:', error)
    }
  }

  const allPreOrder = products.length > 0 && products.every(p => p.preOrderMode)

  const openBulkModal = () => {
    setBulkResult(null)
    setBulkDepositInput('5')
    setBulkModalMode(allPreOrder ? 'disable' : 'enable')
  }

  const confirmBulkPreOrder = async () => {
    const enabling = bulkModalMode === 'enable'
    const defaultDeposit = enabling && bulkDepositInput.trim()
      ? parseFloat(bulkDepositInput) || undefined
      : undefined

    setBulkToggling(true)
    try {
      const response = await fetch('/api/admin/products/bulk-preorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enabling, defaultDeposit })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Failed')
      await fetchProducts()
      if (!enabling) {
        const { balanceRequestsSent = 0, balanceRequestsFailed = 0 } = data
        setBulkResult({ sent: balanceRequestsSent, failed: balanceRequestsFailed })
      } else {
        setBulkModalMode(null)
      }
    } catch (error) {
      console.error('Failed to bulk-toggle pre-order mode:', error)
      alert('Failed to update all products')
    } finally {
      setBulkToggling(false)
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
          <button
            onClick={() => handleToggleFeatured(product)}
            title={product.featured ? 'Remove from Featured Products' : 'Add to Featured Products'}
            className={`p-1.5 rounded-lg transition-colors ${
              product.featured ? 'bg-accent text-black' : 'bg-black/80 hover:bg-black/90 text-white'
            }`}
          >
            <Star className="w-4 h-4" fill={product.featured ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => handleTogglePreOrder(product)}
            title={product.preOrderMode ? 'Turn off pre-order mode' : 'Put this product in pre-order mode'}
            className={`p-1.5 rounded-lg transition-colors ${
              product.preOrderMode ? 'bg-accent text-black' : 'bg-black/80 hover:bg-black/90 text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
          </button>
          <button className="bg-black/80 hover:bg-black/90 text-white p-1.5 rounded-lg transition-colors">
            <Eye className="w-4 h-4" />
          </button>
          <button className="bg-black/80 hover:bg-black/90 text-white p-1.5 rounded-lg transition-colors">
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(product)}
            className="bg-red-600/80 hover:bg-red-600/90 text-white p-1.5 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {product.featured && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Star className="w-3.5 h-3.5 text-accent" fill="currentColor" />
          <span className="text-accent">Featured, position</span>
          <input
            type="number"
            value={product.featuredOrder}
            onChange={(e) => handleFeaturedOrderChange(product, parseInt(e.target.value) || 0)}
            className="w-16 bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-white focus:border-accent focus:outline-none"
          />
        </div>
      )}

      {product.preOrderMode && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-accent/30 bg-accent/5 p-2 text-sm">
          <div className="flex items-center gap-2 text-accent">
            <Clock className="w-3.5 h-3.5" />
            <span>Pre-order deposit $</span>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={product.preOrderDeposit ?? ''}
              placeholder="5.00"
              onChange={(e) => handlePreOrderDepositChange(product, e.target.value ? parseFloat(e.target.value) : null)}
              className="w-20 bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-white focus:border-accent focus:outline-none"
            />
            <span className="text-white/40">of {formatPrice(product.price)}</span>
          </div>
          <input
            type="text"
            value={product.preOrderShipEstimate ?? ''}
            placeholder="Ships in 4-6 weeks"
            onChange={(e) => handlePreOrderShipEstimateChange(product, e.target.value)}
            className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:border-accent focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 whitespace-nowrap">Ships by</span>
            <input
              type="date"
              value={product.preOrderShipBy ? product.preOrderShipBy.slice(0, 10) : ''}
              onChange={(e) => handlePreOrderShipByChange(product, e.target.value)}
              className="flex-1 bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:border-accent focus:outline-none"
            />
          </div>
          {!product.preOrderDeposit && (
            <span className="text-xs text-yellow-500">Set a deposit amount -- pre-order is on but not live to customers without one.</span>
          )}
        </div>
      )}

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
            <div className="flex items-center gap-3">
              <motion.button
                onClick={openBulkModal}
                disabled={bulkToggling || products.length === 0}
                title={allPreOrder ? 'Switch every product back to live' : 'Switch every product into pre-order mode'}
                className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 disabled:opacity-50 ${
                  allPreOrder
                    ? 'bg-accent text-black'
                    : 'bg-black/40 border border-accent/40 text-accent hover:bg-black/60'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Clock className="w-5 h-5" />
                {bulkToggling ? 'Updating...' : allPreOrder ? 'End Pre-Order (All)' : 'Launch Pre-Order (All)'}
              </motion.button>
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

      {/* Bulk Pre-Order Modal */}
      <AnimatePresence>
        {bulkModalMode && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !bulkToggling && setBulkModalMode(null)}
          >
            <motion.div
              className="w-full max-w-sm rounded-xl border border-accent/30 bg-black/90 p-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-accent">
                  <Clock className="w-5 h-5" />
                  <h2 className="font-bold text-white">
                    {bulkResult ? 'Drop Ended' : bulkModalMode === 'enable' ? 'Launch Pre-Order (All)' : 'End Pre-Order (All)'}
                  </h2>
                </div>
                <button onClick={() => setBulkModalMode(null)} className="text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {bulkResult ? (
                <div className="space-y-4">
                  <p className="text-sm text-white/80">
                    All {products.length} products are back to live.
                    {bulkResult.sent > 0 && ` Balance-due emails sent: ${bulkResult.sent}.`}
                    {bulkResult.failed > 0 && ` ${bulkResult.failed} failed -- check those orders individually.`}
                    {bulkResult.sent === 0 && bulkResult.failed === 0 && ' No outstanding deposits needed a balance request.'}
                  </p>
                  <button onClick={() => setBulkModalMode(null)} className="btn-primary w-full">
                    Done
                  </button>
                </div>
              ) : bulkModalMode === 'enable' ? (
                <div className="space-y-4">
                  <p className="text-sm text-white/60">
                    Switches all {products.length} products to pre-order mode. Anything on the shop and home page
                    immediately shows a &quot;Pre-Order&quot; button instead of &quot;Add to Cart.&quot;
                  </p>
                  <div>
                    <label className="mb-1 block text-sm text-white/80">
                      Default deposit ($) for any product that doesn&apos;t already have one set
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={bulkDepositInput}
                      onChange={(e) => setBulkDepositInput(e.target.value)}
                      placeholder="5.00"
                      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder-white/30 focus:border-accent focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-white/40">Leave blank to skip -- products without a deposit set won&apos;t show the Pre-Order button.</p>
                  </div>
                  <button
                    onClick={confirmBulkPreOrder}
                    disabled={bulkToggling}
                    className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-green-400 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {bulkToggling ? 'Launching...' : `Launch Pre-Order for All ${products.length} Products`}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-white/80">
                    This ends the drop and switches all {products.length} products back to live. Every customer
                    with a deposit-paid reservation gets emailed a link to pay their remaining balance right away.
                  </p>
                  <button
                    onClick={confirmBulkPreOrder}
                    disabled={bulkToggling}
                    className="w-full rounded-lg bg-accent py-3 font-semibold text-black disabled:opacity-50"
                  >
                    {bulkToggling ? 'Processing...' : 'End Drop & Send Balance Requests'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}