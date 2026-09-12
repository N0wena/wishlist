import { useEffect, useRef, type MouseEvent } from 'react'
import type { Lot } from '@/types'

type LotDetailProps = {
  lot: Lot
  onClose: () => void
}

/** Деталка: прочитать, зачем автору эта вещь, и написать «беру». */
export function LotDetail({ lot, onClose }: LotDetailProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onScrimClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('[data-panel]')) onClose()
  }

  // «Категория · ориентир 42 000 ₽» — до « · » берётся как тег.
  const tag = lot.subtitle.split(' · ')[0]
  // Число форматируем рублями, строку показываем как есть — там своя валюта.
  const priceText =
    typeof lot.price === 'number'
      ? `${lot.price.toLocaleString('ru-RU')} ₽`
      : (lot.price ?? 'Цена свободная')
  // «#» и пустая строка означают «ссылки пока нет» — кнопку не рисуем.
  const url = lot.url && lot.url !== '#' ? lot.url : undefined
  const alt = `${lot.title} — ${lot.subtitle}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Подробнее о вещи"
      onClick={onScrimClick}
      className="fixed inset-0 z-80 flex animate-wl-fade items-center justify-center bg-[rgba(8,10,13,.9)] p-[clamp(12px,3vw,40px)]"
    >
      <div
        data-panel
        className="grid max-h-full w-[min(100%,940px)] grid-cols-[var(--detail-cols)] overflow-auto rounded-plate border border-edge bg-void"
      >
        <div className="relative min-h-[220px] border-r border-line bg-shelf">
          <img
            src={lot.image}
            alt={alt}
            width={800}
            height={1000}
            className="block h-full max-h-[520px] w-full object-cover"
            style={{ objectPosition: lot.imagePos ?? '50% 50%' }}
          />
        </div>

        <div className="flex flex-col gap-4 p-[clamp(22px,3vw,38px)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold tracking-[0.08em] text-beacon uppercase">
              {tag}
            </span>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="h-9 w-9 cursor-pointer rounded-full border border-edge bg-transparent text-[18px] leading-none text-smoke"
            >
              ×
            </button>
          </div>

          <h2 className="m-0 font-display text-[clamp(28px,3.4vw,48px)] leading-[1.04] font-bold tracking-[0.02em] text-smoke uppercase">
            {lot.title}
          </h2>

          {lot.note && (
            <p className="m-0 text-[17px] leading-[1.55] text-pretty text-smoke">{lot.note}</p>
          )}

          {/* У заглушки цены нет — подарок ещё не придуман. */}
          {!lot.pending && (
            <div className="flex flex-wrap items-baseline gap-x-[18px] gap-y-2 border-y border-line py-3.5">
              <span className="font-display text-[26px] font-semibold tracking-[0.02em] text-smoke">
                {priceText}
              </span>
              <span className="text-sm text-soft">~стоимость</span>
            </div>
          )}

          {url && (
            <div className="flex flex-wrap items-center gap-3">
              <a href={url} target="_blank" rel="noopener" className="text-[15px]">
                Посмотреть, что это
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
