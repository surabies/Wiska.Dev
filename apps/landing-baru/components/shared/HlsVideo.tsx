"use client";

import type Hls from "hls.js";
import { useEffect, useRef } from "react";

interface HlsVideoProps {
  /** URL stream HLS (.m3u8) or path to a browser-supported video file. */
  src: string;
  className?: string;
}

/** Video latar autoplay. Safari memutar HLS native; browser lain via hls.js. */
export function HlsVideo({ src, className }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHlsSource = /\.m3u8(?:$|[?#])/i.test(src);
    if (!isHlsSource || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    let hls: Hls | undefined;
    let cancelled = false;

    import("hls.js").then(({ default: HlsJs }) => {
      if (cancelled || !HlsJs.isSupported()) return;
      hls = new HlsJs();
      hls.loadSource(src);
      hls.attachMedia(video);
    });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  );
}
