'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

// Floating music notes component
export function FloatingMusicNotes() {
  const notes = ['♪', '♫', '♬', '♩', '♭', '♯']
  const [noteConfigs, setNoteConfigs] = useState<Array<{
    left: number;
    top: number;
    xMovement: number;
    duration: number;
    noteIndex: number;
  }>>([])

  useEffect(() => {
    const configs = [...Array(12)].map(() => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      xMovement: Math.random() * 100 - 50,
      duration: 8 + Math.random() * 4,
      noteIndex: Math.floor(Math.random() * notes.length)
    }))
    setNoteConfigs(configs)
  }, [notes.length])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {noteConfigs.map((config, index) => (
        <motion.div
          key={index}
          className="absolute text-accent/20 text-2xl font-bold"
          style={{
            left: `${config.left}%`,
            top: `${config.top}%`,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, config.xMovement, 0],
            rotate: [0, 360, 0],
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: config.duration,
            repeat: Infinity,
            delay: index * 0.8,
            ease: "easeInOut",
          }}
        >
          {notes[config.noteIndex]}
        </motion.div>
      ))}
    </div>
  )
}