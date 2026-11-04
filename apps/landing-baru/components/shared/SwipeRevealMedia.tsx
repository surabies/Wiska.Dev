"use client";

import type { ReactNode } from "react";

import { useInView } from "@/hooks/use-in-view";

interface SwipeRevealMediaProps {
  children: ReactNode;
}

/**
 * Media muncul dengan efek "tirai": blok abu-abu naik ke atas sementara
 * gambar/video bergeser ke posisi akhir saat masuk viewport.
 */
export function SwipeRevealMedia({ children }: SwipeRevealMediaProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.2 });

  return (
    <div
      ref={ref}
      data-in-view={inView}
      className="group/reveal relative w-full overflow-hidden text-[0px] [--reveal-offset:60px] min-[420px]:[--reveal-offset:80px] md:[--reveal-offset:100px] data-[in-view=true]:[--reveal-offset:0px] motion-reduce:[--reveal-offset:0px]"
    >
      <div className="relative z-0 translate-y-(--reveal-offset) transition-transform duration-250 ease-out-sine">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-placeholder transition-transform duration-350 ease-out-sine group-data-[in-view=true]/reveal:-translate-y-full motion-reduce:hidden"
      />
    </div>
  );
}
