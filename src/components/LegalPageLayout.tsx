import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface LegalPageLayoutProps {
  title: string
  updated: string
  children: React.ReactNode
}

export default function LegalPageLayout({ title, updated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-accent hover:underline mb-8 text-sm">
          <ArrowLeft size={16} />
          Back to Juice Junkies
        </Link>

        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-gray-400 text-sm mb-10">Last updated: {updated}</p>

        <div
          className="space-y-4 text-gray-300 leading-relaxed
            [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-3
            [&_p]:mb-3
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ul]:mb-3
            [&_a]:text-accent [&_a]:hover:underline"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
