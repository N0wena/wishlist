/**
 * Circular Gallery — по мотивам 21st.dev, @ravikatiyar162.
 * https://21st.dev/@ravikatiyar162/components/circular-gallery
 *
 * Исходник компонента закрыт авторизацией реестра, поэтому кольцо собрано по
 * формулам дизайн-хендоффа. Форма props намеренно держится близко к
 * документированному API 21st (`items: GalleryItem[]`), чтобы настоящий исходник
 * подменялся одним файлом.
 *
 * Вся анимация — прямая запись в DOM из одного rAF-цикла: на кадр не приходится
 * ни одного React-рендера.
 */
'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
  type Ref,
} from 'react'
import { useInViewport } from '@/hooks/use-in-viewport'
import { cn } from '@/lib/utils'

export type CircularGalleryItem = {
  id: string
  title: string
  subtitle: string
  photo: {
    url: string
    /** Альтернативный текст. */
    text: string
    /** `object-position`, например '65% 35%'. */
    pos?: string
  }
  /** Сила свечения передней плиты: вес желания 1…3. */
  glow?: number
}

export type CircularGalleryHandle = {
  /** Вернуть фокус на плиту — например, после закрытия деталки. */
  focusPlate: (index: number) => void
}

type CircularGalleryProps = {
  items: CircularGalleryItem[]
  /** Открыть деталку лота. */
  onOpen: (index: number) => void
  /** Высота секции-обёртки: чем больше, тем медленнее крутится кольцо. */
  scrollHeight?: string
  label?: string
  ctaLabel?: string
  reducedMotion?: boolean
  ref?: Ref<CircularGalleryHandle>
  id?: string
  className?: string
}

/** Инерция догоняния целевого угла; при reduced-motion не применяется. */
const INERTIA = 0.12
/** Радиус кольца заметно больше вписанного — плиты не задевают друг друга. */
const RADIUS_SLACK = 1.42

const pad2 = (n: number) => String(n).padStart(2, '0')

export function CircularGallery({
  items,
  onOpen,
  scrollHeight = '520vh',
  label = 'Кольцо',
  ctaLabel = 'Рассмотреть поближе',
  reducedMotion = false,
  ref,
  id,
  className,
}: CircularGalleryProps) {
  const wrapRef = useRef<HTMLElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const plateRefs = useRef<(HTMLButtonElement | null)[]>([])

  const rotRef = useRef(0)
  const frontRef = useRef(0)
  const radiusRef = useRef(0)
  const scrollerRef = useRef<HTMLElement | null | undefined>(undefined)

  useImperativeHandle(ref, () => ({
    focusPlate: (index) => plateRefs.current[index]?.focus({ preventScroll: true }),
  }))

  /**
   * Скролл-контейнер определяется динамически: в проде это window, но логика
   * устойчива к обёрткам с собственным overflow.
   */
  const scroller = useCallback(() => {
    if (scrollerRef.current !== undefined) return scrollerRef.current
    let el: HTMLElement | null = wrapRef.current
    while (el && el !== document.body) {
      const cs = getComputedStyle(el)
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) {
        scrollerRef.current = el
        return el
      }
      el = el.parentElement
    }
    const body = document.body
    scrollerRef.current =
      body.scrollHeight > body.clientHeight + 4 &&
      /(auto|scroll)/.test(getComputedStyle(body).overflowY)
        ? body
        : null
    return scrollerRef.current
  }, [])

  const viewportHeight = useCallback(() => {
    const s = scroller()
    return s ? s.clientHeight : window.innerHeight
  }, [scroller])

  const scrollToIndex = useCallback(
    (index: number) => {
      const wrap = wrapRef.current
      const n = items.length
      if (!wrap || n < 2) return
      const span = wrap.offsetHeight - viewportHeight()
      const cur = -wrap.getBoundingClientRect().top
      const delta = span * (index / (n - 1)) - cur
      const opts: ScrollToOptions = {
        top: delta,
        behavior: reducedMotion ? 'auto' : 'smooth',
      }
      const s = scroller()
      if (s) s.scrollBy(opts)
      else window.scrollBy(opts)
    },
    [scroller, viewportHeight, items.length, reducedMotion],
  )

  // Вне экрана кадры не считаем: цикл трогает getBoundingClientRect и пишет
  // стили десяти плитам, а секция занимает лишь часть длинной страницы.
  const inView = useInViewport(wrapRef)

  // ---- раскладка и кадр -------------------------------------------------
  useEffect(() => {
    const n = items.length
    if (n === 0 || !inView) return

    const stepAngle = 360 / n
    let progress = 0
    let frame = 0

    const layout = () => {
      const plateW = plateRefs.current[0]?.offsetWidth || 200
      radiusRef.current = Math.round((plateW / 2) / Math.tan(Math.PI / n) * RADIUS_SLACK)
    }

    const paint = (force = false) => {
      const R = radiusRef.current || 300
      const rot = rotRef.current

      for (let i = 0; i < n; i++) {
        const el = plateRefs.current[i]
        if (!el) continue
        const angle = i * stepAngle + rot
        const near = Math.max(0, Math.cos((angle * Math.PI) / 180))

        el.style.transform = `rotateY(${angle.toFixed(2)}deg) translateZ(${R}px)`
        el.style.opacity = (0.16 + 0.84 * Math.pow(near, 1.5)).toFixed(3)
        el.style.zIndex = String(Math.round(near * 100))
        el.style.pointerEvents = near > 0.55 ? 'auto' : 'none'

        const weight = items[i].glow ?? 1
        const spread = near > 0.8 ? weight * 12 * (near - 0.8) * 5 : 0
        const face = el.firstElementChild as HTMLElement | null
        if (face) {
          face.style.boxShadow =
            spread > 0.5
              ? `0 0 ${spread.toFixed(0)}px rgba(140,195,242,${(0.1 + weight * 0.07).toFixed(2)})`
              : 'none'
        }
      }

      const front = ((Math.round(-rot / stepAngle) % n) + n) % n
      if (front !== frontRef.current || force) {
        frontRef.current = front
        const item = items[front]
        if (titleRef.current) titleRef.current.textContent = item.title
        if (subtitleRef.current) subtitleRef.current.textContent = item.subtitle
        if (counterRef.current) {
          counterRef.current.textContent = `${pad2(front + 1)} / ${pad2(n)}`
        }
        for (let i = 0; i < n; i++) {
          plateRefs.current[i]?.setAttribute('aria-selected', i === front ? 'true' : 'false')
        }
      }

      if (progressRef.current) {
        progressRef.current.style.width = `${(progress * 100).toFixed(1)}%`
      }
    }

    const loop = () => {
      const wrap = wrapRef.current
      if (wrap) {
        const span = wrap.offsetHeight - viewportHeight()
        const p =
          span > 0
            ? Math.min(1, Math.max(0, -wrap.getBoundingClientRect().top / span))
            : 0
        const target = -p * 360 * (n - 1) / n

        if (reducedMotion) {
          rotRef.current = target
        } else {
          rotRef.current += (target - rotRef.current) * INERTIA
          if (Math.abs(target - rotRef.current) < 0.01) rotRef.current = target
        }

        progress = p
        paint()
      }
      frame = requestAnimationFrame(loop)
    }

    layout()
    paint(true)
    frame = requestAnimationFrame(loop)

    const onResize = () => {
      scrollerRef.current = undefined
      layout()
      paint(true)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [items, viewportHeight, reducedMotion, inView])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const n = items.length
    if (n === 0) return
    const { key } = event
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      event.preventDefault()
      scrollToIndex(Math.min(n - 1, frontRef.current + 1))
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      event.preventDefault()
      scrollToIndex(Math.max(0, frontRef.current - 1))
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      onOpen(frontRef.current)
    }
  }

  const first = items[0]

  return (
    <section
      id={id}
      ref={wrapRef}
      aria-label="Кольцо желаний"
      style={{ height: scrollHeight }}
      className={cn('relative', className)}
    >
      <div className="sticky top-0 grid h-[100svh] grid-rows-[auto_1fr_auto] overflow-hidden">
        {/* Ряд 1 — хедер кольца */}
        <div className="relative z-3 flex items-center justify-between gap-4 px-[clamp(20px,5vw,72px)] py-[clamp(16px,3vw,28px)]">
          <span className="font-display text-[clamp(13px,1.2vw,17px)] font-semibold tracking-[0.12em] text-smoke uppercase">
            {label}
          </span>
          <div className="relative h-0.5 max-w-[420px] flex-1 bg-line">
            <span ref={progressRef} className="absolute inset-y-0 left-0 block w-0 bg-beacon" />
          </div>
          <span ref={counterRef} className="min-w-[6ch] text-right text-sm text-soft">
            {`01 / ${pad2(items.length)}`}
          </span>
        </div>

        {/* Ряд 2 — сцена кольца */}
        <div
          tabIndex={0}
          role="listbox"
          aria-label="Вещи в кольце, стрелками влево-вправо"
          onKeyDown={onKeyDown}
          className="relative"
          style={{ perspective: '1400px', perspectiveOrigin: '50% 45%' }}
        >
          <div
            ref={ringRef}
            className="absolute top-[48%] left-1/2 h-0 w-0"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === 0}
                aria-label={`${item.title} — ${item.subtitle}`}
                ref={(el) => {
                  plateRefs.current[index] = el
                }}
                onClick={() => onOpen(index)}
                onFocus={() => {
                  if (index !== frontRef.current) scrollToIndex(index)
                }}
                className="absolute top-0 left-0 w-[var(--plate-w)] cursor-pointer border-0 bg-transparent p-0 will-change-[transform,opacity]"
                style={{
                  transformStyle: 'preserve-3d',
                  aspectRatio: '4 / 5',
                  // Плита центрируется на оси кольца, чтобы transform-origin
                  // совпал с её собственным центром.
                  marginLeft: 'calc(var(--plate-w) / -2)',
                  marginTop: 'calc(var(--plate-w) * -0.625)',
                }}
              >
                <span className="absolute inset-0 block overflow-hidden rounded-plate border border-edge bg-shelf">
                  <img
                    src={item.photo.url}
                    alt=""
                    loading="lazy"
                    width={800}
                    height={1000}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: item.photo.pos ?? '50% 50%' }}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Ряд 3 — подпись переднего лота */}
        <div className="relative z-3 px-[clamp(20px,5vw,72px)] pt-[clamp(20px,4vw,44px)] pb-[clamp(24px,5vw,56px)]">
          <div className="inline-block max-w-[min(100%,620px)] rounded-plate border border-edge bg-void px-[clamp(18px,3vw,30px)] py-[clamp(16px,2.5vw,26px)]">
            <h2
              ref={titleRef}
              className="m-0 mb-2 font-display text-[clamp(26px,4vw,52px)] leading-[1.04] font-bold tracking-[0.02em] text-smoke uppercase"
            >
              {first?.title ?? ''}
            </h2>
            <p ref={subtitleRef} className="m-0 mb-3.5 text-[clamp(14px,1.3vw,17px)] text-soft">
              {first?.subtitle ?? ''}
            </p>
            <button
              type="button"
              onClick={() => onOpen(frontRef.current)}
              className="cursor-pointer rounded-plate border-0 bg-smoke px-6 py-[13px] text-[15px] font-semibold text-void transition-opacity duration-200 ease-wl hover:opacity-[0.82]"
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CircularGallery
