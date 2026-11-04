import { useEffect, useRef, useState } from "react"

interface UseInViewOptions {
  threshold?: number
  /** `true` = berhenti mengamati setelah pertama kali terlihat. */
  once?: boolean
}

export function useInView<T extends Element>({
  threshold = 0.2,
  once = true,
}: UseInViewOptions = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
        if (entry.isIntersecting && once) observer.disconnect()
      },
      { threshold }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, once])

  return { ref, inView }
}
