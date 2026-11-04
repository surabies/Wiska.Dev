"use client"

import { useEffect, useRef } from "react"

interface HlsVideoProps {
  /** URL stream HLS (.m3u8) atau file video (.mp4, .webm). */
  src: string
  className?: string
  poster?: string
}

/** Video latar autoplay yang responsif dan hemat daya. */
export function HlsVideo({ src, className, poster }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.src = src
  }, [src])

  return (
    <video
      ref={videoRef}
      className={className}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  )
}
