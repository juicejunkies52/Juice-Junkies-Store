// Original critter designs for the catch-and-collect easter egg -- simple
// geometric shapes in the same line/path style as the existing butterfly,
// not based on any existing character or franchise.

export default function CreatureSvg({ type, size = 36 }: { type: string; size?: number }) {
  switch (type) {
    case 'firefly':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="drop-shadow-[0_0_6px_currentColor]">
          <ellipse cx="20" cy="22" rx="7" ry="9" fill="currentColor" fillOpacity="0.8" />
          <circle cx="20" cy="30" r="3" fill="currentColor" />
          <ellipse cx="11" cy="16" rx="8" ry="4" fill="currentColor" fillOpacity="0.4" transform="rotate(-20 11 16)" />
          <ellipse cx="29" cy="16" rx="8" ry="4" fill="currentColor" fillOpacity="0.4" transform="rotate(20 29 16)" />
        </svg>
      )
    case 'ladybug':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="drop-shadow-[0_0_6px_currentColor]">
          <circle cx="20" cy="22" r="13" fill="currentColor" fillOpacity="0.85" />
          <line x1="20" y1="9" x2="20" y2="35" stroke="black" strokeOpacity="0.3" strokeWidth="1.5" />
          <circle cx="14" cy="17" r="2" fill="black" fillOpacity="0.4" />
          <circle cx="26" cy="17" r="2" fill="black" fillOpacity="0.4" />
          <circle cx="14" cy="27" r="2" fill="black" fillOpacity="0.4" />
          <circle cx="26" cy="27" r="2" fill="black" fillOpacity="0.4" />
          <circle cx="20" cy="8" r="4" fill="currentColor" />
        </svg>
      )
    case 'moth':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="drop-shadow-[0_0_6px_currentColor]">
          <line x1="20" y1="5" x2="20" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M20,14 L4,4 L7,20 L20,18 Z" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1" />
          <path d="M20,14 L36,4 L33,20 L20,18 Z" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1" />
          <path d="M20,20 L8,28 L12,37 L20,30 Z" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1" />
          <path d="M20,20 L32,28 L28,37 L20,30 Z" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1" />
        </svg>
      )
    case 'dragonfly':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="drop-shadow-[0_0_6px_currentColor]">
          <line x1="20" y1="2" x2="20" y2="38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="18" cy="6" r="2.5" fill="currentColor" />
          <circle cx="22" cy="6" r="2.5" fill="currentColor" />
          <ellipse cx="7" cy="14" rx="11" ry="3" fill="currentColor" fillOpacity="0.35" transform="rotate(-10 7 14)" />
          <ellipse cx="33" cy="14" rx="11" ry="3" fill="currentColor" fillOpacity="0.35" transform="rotate(10 33 14)" />
          <ellipse cx="9" cy="21" rx="10" ry="2.5" fill="currentColor" fillOpacity="0.35" transform="rotate(-6 9 21)" />
          <ellipse cx="31" cy="21" rx="10" ry="2.5" fill="currentColor" fillOpacity="0.35" transform="rotate(6 31 21)" />
        </svg>
      )
    case 'goldencarton':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="creature-999-cycle drop-shadow-[0_0_10px_currentColor]">
          <text x="20" y="27" textAnchor="middle" fontSize="15" fontWeight="bold" fontFamily="monospace" fill="currentColor">999</text>
        </svg>
      )
    case 'phoenix':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="drop-shadow-[0_0_8px_currentColor]">
          <path d="M20,4 C24,12 24,18 20,24 C16,18 16,12 20,4 Z" fill="currentColor" fillOpacity="0.9" />
          <path d="M20,16 L4,10 L12,22 L20,20 Z" fill="currentColor" fillOpacity="0.6" />
          <path d="M20,16 L36,10 L28,22 L20,20 Z" fill="currentColor" fillOpacity="0.6" />
          <path d="M20,20 C26,24 28,30 20,37 C12,30 14,24 20,20 Z" fill="currentColor" fillOpacity="0.85" />
        </svg>
      )
    default:
      return null
  }
}
