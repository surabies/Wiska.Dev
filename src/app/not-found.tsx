"use client"

import { Snake404 } from "@/components/ui/snake-404"

export default function NotFound() {
  return (
    <section className="relative isolate min-h-svh overflow-hidden bg-background">
      <Snake404 />
      <div className="pointer-events-none relative z-10 flex min-h-svh flex-col items-center justify-end px-6 pb-16 text-center">
        <p className="text-sm text-muted-foreground">
          This page could not be found.
        </p>
      </div>
    </section>
  )
}