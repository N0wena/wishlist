import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { BackgroundPaths } from '@/components/ui/background-paths'
import { Loader } from '@/components/ui/loader'
import { ProfileCard } from '@/components/ui/profile-card'

/** Человек, который помогает собрать подарок. */
const ORGANIZER = {
  name: 'Лиза',
  handle: '@iamokaythankyou',
  avatar: '/liza.jpeg',
  bio: 'С радостью готова помочь с организацией подарка на безвозмездной основе. Всегда готова помогать друзьям своих друзей.',
  href: 'https://t.me/iamokaythankyou',
}

/** Искусственная пауза перед карточкой — чтобы лоадер было видно. */
const FAKE_DELAY_MS = 1000

export function OrganizerSection() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  const openModal = useCallback(() => {
    openerRef.current = document.activeElement as HTMLElement | null
    setLoading(true)
    setOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setOpen(false)
    openerRef.current?.focus({ preventScroll: true })
  }, [])

  // Лоадер крутится ровно секунду, потом показываем контакты.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setLoading(false), FAKE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeModal])

  useEffect(() => {
    if (open && !loading) closeRef.current?.focus()
  }, [open, loading])

  const onScrimClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('[data-panel]')) closeModal()
  }

  return (
    <section aria-label="Как организовать подарок" className="relative border-t border-line">
      <BackgroundPaths
        title="Как организовать подарок?"
        ctaLabel="Найти человека"
        onCta={openModal}
      />

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Контакты организатора"
          onClick={onScrimClick}
          className="fixed inset-0 z-80 flex animate-wl-fade items-center justify-center bg-[rgba(8,10,13,.9)] p-[clamp(12px,3vw,40px)]"
        >
          {/* ширина живёт на панели: карточка внутри — flex-элемент, и её
              собственный `w-[min(100%,380px)]` схлопывался бы почти в ноль */}
          <div data-panel className="relative max-h-full w-[min(100%,570px)] overflow-auto">
            {loading ? (
              <div className="flex h-[620px] w-full items-center justify-center rounded-2xl border border-edge bg-void">
                <Loader size={76} label="Ищем человека" />
              </div>
            ) : (
              <>
                <ProfileCard
                  className="w-full"
                  name={ORGANIZER.name}
                  handle={ORGANIZER.handle}
                  avatar={ORGANIZER.avatar}
                  bio={ORGANIZER.bio}
                  actionLabel="Написать в Telegram"
                  actionHref={ORGANIZER.href}
                />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeModal}
                  aria-label="Закрыть"
                  className="absolute top-4 right-4 z-10 h-9 w-9 cursor-pointer rounded-full border border-edge bg-void/70 text-[18px] leading-none text-smoke backdrop-blur-sm"
                >
                  ×
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
