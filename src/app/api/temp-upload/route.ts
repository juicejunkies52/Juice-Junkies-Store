import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

// TEMPORARY: one-off endpoint used to move locally-downloaded Printful
// mockups into Blob storage. Deleted immediately after use.
const TEMP_UPLOAD_SECRET = 'nlcHsYuvmQ6KikD38WA3ygp3mq2QkURYP_qgfQy_iuw'

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('secret') !== TEMP_UPLOAD_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  const blob = await put(`product-mockups/${Date.now()}-${file.name}`, file, { access: 'public' })
  return NextResponse.json({ url: blob.url })
}
