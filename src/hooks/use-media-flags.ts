import { useEffect, useState } from 'react'

/** Подписка на media-query с корректным SSR-безопасным первым чтением. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** `prefers-reduced-motion: reduce` — страница остаётся полноценной, но без движения. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** Мобильный брейкпоинт хендоффа. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 760px)')
}
