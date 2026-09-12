import { useEffect, useState, type RefObject } from 'react'

/**
 * Видна ли секция (с запасом по краям). Нужно, чтобы тяжёлые анимации
 * не крутились, пока до них не долистали: страница длинная, а блоков
 * с бесконечной анимацией на ней несколько.
 */
export function useInViewport(
  ref: RefObject<HTMLElement | null>,
  { rootMargin = '200px', initial = false } = {},
): boolean {
  const [inView, setInView] = useState(initial)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => setInView(entries[0].isIntersecting),
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin])

  return inView
}
