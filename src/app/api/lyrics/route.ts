import { NextRequest, NextResponse } from 'next/server'

// Proxies lyric search to the community-run Juice WRLD API
// (juicewrldapi.com) instead of calling it directly from the browser: keeps
// their base URL out of client code, lets us trim their (large, full-lyrics)
// response down to just what the UI needs, and lets Next cache identical
// queries for a while so we're not hammering a free fan-run service on
// every search.
const JUICEWRLD_API_BASE = 'https://juicewrldapi.com/juicewrld'

interface JuiceWrldSong {
  id: number
  name: string
  category: string
  era?: { name: string } | null
  credited_artists?: string
  release_date?: string
  lyrics?: string
}

function buildExcerpt(lyrics: string, query: string): string {
  const idx = lyrics.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) {
    return lyrics.replace(/\r?\n/g, ' ').slice(0, 140).trim() + '…'
  }
  const start = Math.max(0, idx - 60)
  const end = Math.min(lyrics.length, idx + query.length + 60)
  const snippet = lyrics.slice(start, end).replace(/\r?\n/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${snippet}${end < lyrics.length ? '…' : ''}`
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json({ error: 'q is required' }, { status: 400 })
  }

  if (query.length < 3) {
    return NextResponse.json({ error: 'Search for at least 3 characters' }, { status: 400 })
  }

  try {
    const upstreamUrl = `${JUICEWRLD_API_BASE}/songs/?lyrics=${encodeURIComponent(query)}`
    const response = await fetch(upstreamUrl, {
      next: { revalidate: 3600 } // cache identical searches for an hour
    })

    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`)
    }

    const data = await response.json()
    const songs: JuiceWrldSong[] = data.results || []

    const results = songs.slice(0, 30).map(song => ({
      id: song.id,
      name: song.name,
      category: song.category,
      era: song.era?.name || null,
      creditedArtists: song.credited_artists || null,
      releaseDate: song.release_date || null,
      excerpt: song.lyrics ? buildExcerpt(song.lyrics, query) : null
    }))

    return NextResponse.json({
      count: data.count ?? results.length,
      results
    })
  } catch (error) {
    console.error('Lyric search error:', error)
    return NextResponse.json(
      { error: 'Lyric search is temporarily unavailable' },
      { status: 502 }
    )
  }
}
