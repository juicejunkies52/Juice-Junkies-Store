'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react'

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0.3)
  const [isVisible, setIsVisible] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Show audio control after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(console.error)
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }

  return (
    <>
      {/* Ambient audio - placeholder for when you add audio files */}
      <audio
        ref={audioRef}
        loop
        preload="none"
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      >
        {/* Add your audio files to public/audio/ directory */}
        {/* <source src="/audio/ambient-space.mp3" type="audio/mpeg" /> */}
      </audio>

      {/* Floating Audio Control */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="fixed bottom-6 right-6 z-50"
            initial={{ opacity: 0, scale: 0, rotate: -180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0, rotate: 180 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <div className="bg-black/80 backdrop-blur-md rounded-full border border-accent/50 p-4 shadow-2xl">
              <div className="flex items-center gap-3">
                {/* Play/Pause Button */}
                <motion.button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-green-400 flex items-center justify-center text-white hover:shadow-lg neon-glow"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  title={isPlaying ? "Pause ambient sounds" : "Play ambient sounds"}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 ml-0.5" />
                  ) : (
                    <Play className="w-5 h-5 ml-1" />
                  )}
                </motion.button>

                {/* Volume Controls */}
                <div className="flex items-center gap-2 text-white">
                  <motion.button
                    onClick={toggleMute}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </motion.button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 accent-accent"
                    title="Volume"
                  />
                </div>

                {/* Music Icon with Animation */}
                <motion.div
                  animate={isPlaying ? {
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1]
                  } : {}}
                  transition={{
                    duration: 2,
                    repeat: isPlaying ? Infinity : 0,
                    ease: "easeInOut"
                  }}
                >
                  <Music className="w-5 h-5 text-accent" />
                </motion.div>
              </div>

              {/* Playing indicator */}
              {isPlaying && (
                <motion.div
                  className="flex justify-center mt-2 gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-accent rounded-full"
                      animate={{
                        height: [4, 12, 4],
                        opacity: [0.4, 1, 0.4]
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.3,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </div>

            {/* Tooltip */}
            <motion.div
              className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: isPlaying ? 0 : 1 }}
              transition={{ delay: 1 }}
            >
              <div className="bg-black/90 text-white text-xs px-3 py-1 rounded-lg border border-accent/30 whitespace-nowrap">
                Ambient vibes for your shopping ✨
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}