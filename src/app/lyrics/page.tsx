'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, ArrowLeft, Music, Disc3 } from 'lucide-react'
import Link from 'next/link'
import EnhancedButterflies from '@/components/EnhancedButterflies'

interface LyricResult {
  id: number
  name: string
  category: string
  era: string | null
  creditedArtists: string | null
  releaseDate: string | null
  excerpt: string | null
}

function CategoryBadge({ category }: { category: string }) {
  const normalized = category.toLowerCase()
  const isReleased = normalized === 'released'

  return (
    <span
      className={`px-2 py-1 text-xs rounded-full font-medium ${
        isReleased ? 'bg-green-400/20 text-green-400' : 'bg-yellow-400/20 text-yellow-400'
      }`}
    >
      {category}
    </span>
  )
}

export default function LyricsPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LyricResult[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()

    if (trimmed.length < 3) {
      setError('Type at least 3 characters')
      return
    }

    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      const response = await fetch(`/api/lyrics?q=${encodeURIComponent(trimmed)}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong')
        setResults([])
        setCount(null)
        return
      }

      setResults(data.results)
      setCount(data.count)
    } catch {
      setError('Something went wrong')
      setResults([])
      setCount(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EnhancedButterflies />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-accent hover:underline mb-8 text-sm">
          <ArrowLeft size={16} />
          Back to Juice Junkies
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Music className="text-accent" />
            Lyric Search
          </h1>
          <p className="text-gray-400 text-sm">
            Type part of a lyric to find which songs it's from — released and unreleased.
            Powered by{' '}
            <a
              href="https://juicewrldapi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              juicewrldapi.com
            </a>
            .
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 mb-10">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. all girls are the same"
            className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-accent focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Search size={18} />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 rounded-lg bg-red-900/20 border border-red-500/50 text-red-300 text-sm mb-8"
          >
            {error}
          </motion.div>
        )}

        {searched && !loading && !error && (
          <p className="text-gray-400 text-sm mb-6">
            {count === 0 ? 'No matches found.' : `${count} song${count === 1 ? '' : 's'} found`}
          </p>
        )}

        <div className="space-y-4">
          {results.map((song, index) => (
            <motion.div
              key={song.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-900/30 border border-gray-800 rounded-lg p-5 hover:border-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="text-white font-semibold text-lg">{song.name}</h3>
                <CategoryBadge category={song.category} />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                {song.era && (
                  <span className="flex items-center gap-1">
                    <Disc3 size={12} />
                    {song.era}
                  </span>
                )}
                {song.creditedArtists && <span>feat. {song.creditedArtists}</span>}
                {song.releaseDate && <span>{song.releaseDate}</span>}
              </div>

              {song.excerpt && (
                <p className="text-gray-300 text-sm italic leading-relaxed">
                  &ldquo;{song.excerpt}&rdquo;
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
