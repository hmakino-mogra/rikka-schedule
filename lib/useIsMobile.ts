import { useState, useEffect } from 'react'

/**
 * Returns true when the viewport width is less than `breakpoint` pixels.
 * Defaults to 768px (standard mobile breakpoint).
 * SSR-safe: starts as false, updates after hydration.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
