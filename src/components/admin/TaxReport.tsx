'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, Calendar, DollarSign, FileText, TrendingUp } from 'lucide-react'

interface TaxData {
  period: string
  totalSales: number
  taxableAmount: number
  taxCollected: number
  exemptSales: number
  transactionCount: number
}

export default function TaxReport() {
  const [selectedPeriod, setSelectedPeriod] = useState('current-quarter')
  const [taxData, setTaxData] = useState<TaxData | null>(null)
  const [loading, setLoading] = useState(false)

  const periods = [
    { value: 'current-month', label: 'Current Month' },
    { value: 'last-month', label: 'Last Month' },
    { value: 'current-quarter', label: 'Current Quarter' },
    { value: 'last-quarter', label: 'Last Quarter' },
    { value: 'current-year', label: 'Current Year' },
    { value: 'last-year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' },
  ]

  const fetchTaxData = async (period: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tax-report?period=${period}`)
      if (response.ok) {
        const data = await response.json()
        setTaxData(data)
      }
    } catch (error) {
      console.error('Failed to fetch tax data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTaxData(selectedPeriod)
  }, [selectedPeriod])

  const exportReport = async () => {
    try {
      const response = await fetch(`/api/admin/tax-export?period=${selectedPeriod}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tax-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to export report:', error)
    }
  }

  const scTaxRate = parseFloat(process.env.NEXT_PUBLIC_SC_SALES_TAX_RATE || '0.07')
  const scTaxRegistration = process.env.NEXT_PUBLIC_SC_TAX_REGISTRATION_NUMBER || 'Pending'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Tax Reporting</h1>
          <p className="text-gray-400 mt-2">
            SC Sales Tax Registration: {scTaxRegistration}
          </p>
        </div>

        <motion.button
          onClick={exportReport}
          disabled={!taxData}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
            taxData
              ? 'bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          whileHover={taxData ? { scale: 1.05 } : {}}
          whileTap={taxData ? { scale: 0.95 } : {}}
        >
          <Download className="w-4 h-4" />
          Export Report
        </motion.button>
      </div>

      {/* Period Selection */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-semibold text-white">Reporting Period</h2>
        </div>

        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="w-full md:w-auto px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:border-accent focus:outline-none"
        >
          {periods.map((period) => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tax Summary Cards */}
      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-2">Loading tax data...</p>
        </div>
      ) : taxData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <h3 className="text-sm font-semibold text-white">Total Sales</h3>
            </div>
            <p className="text-2xl font-bold text-white">
              ${taxData.totalSales.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {taxData.transactionCount} transactions
            </p>
          </motion.div>

          <motion.div
            className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Taxable Amount</h3>
            </div>
            <p className="text-2xl font-bold text-white">
              ${taxData.taxableAmount.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Subject to SC sales tax
            </p>
          </motion.div>

          <motion.div
            className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-semibold text-white">Tax Collected</h3>
            </div>
            <p className="text-2xl font-bold text-accent">
              ${taxData.taxCollected.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              SC sales tax ({(scTaxRate * 100).toFixed(1)}%)
            </p>
          </motion.div>

          <motion.div
            className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              <h3 className="text-sm font-semibold text-white">Exempt Sales</h3>
            </div>
            <p className="text-2xl font-bold text-white">
              ${taxData.exemptSales.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Out-of-state sales
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">No tax data available for this period</p>
        </div>
      )}

      {/* Compliance Info */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">SC Tax Compliance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-white mb-2">Filing Requirements</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Monthly filing if annual liability &gt; $100</li>
              <li>• Quarterly filing if annual liability $25-$100</li>
              <li>• Annual filing if annual liability &lt; $25</li>
              <li>• Due 20th of the month following period</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">Next Steps</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• File SC sales tax return monthly</li>
              <li>• Remit collected taxes by due date</li>
              <li>• Keep detailed transaction records</li>
              <li>• Monitor tax rate changes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}