import { useCallback, useMemo, useRef, useState } from 'react'
import { Hero } from '@/components/hero'
import { IntroOverlay } from '@/components/intro-overlay'
import { LotDetail } from '@/components/lot-detail'
import { M5Section } from '@/components/m5-section'
import { OrganizerSection } from '@/components/organizer-section'
import {
  CircularGallery,
  type CircularGalleryHandle,
  type CircularGalleryItem,
} from '@/components/ui/circular-gallery'
import { lots } from '@/data/lots'
import { useIsMobile, useReducedMotion } from '@/hooks/use-media-flags'

export default function App() {
  const reducedMotion = useReducedMotion()
  const isMobile = useIsMobile()

  // Интро играет на каждом заходе — ничего не запоминаем. Не играет только
  // при reduced-motion.
  const [introVisible, setIntroVisible] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const ringRef = useRef<CircularGalleryHandle>(null)

  const items = useMemo<CircularGalleryItem[]>(
    () =>
      lots.map((lot) => ({
        id: lot.id,
        title: lot.title,
        subtitle: lot.subtitle,
        photo: {
          url: lot.image,
          text: `${lot.title} — ${lot.subtitle}`,
          pos: lot.imagePos,
        },
        glow: lot.weight,
      })),
    [],
  )

  const closeLot = useCallback(() => {
    setActiveIndex((index) => {
      if (index !== null) ringRef.current?.focusPlate(index)
      return null
    })
  }, [])

  const active = activeIndex === null ? null : lots[activeIndex]

  return (
    <div className="relative bg-void font-sans text-smoke">
      {introVisible && (
        <IntroOverlay
          holdMs={isMobile ? 1000 : 1530}
          onDone={() => setIntroVisible(false)}
        />
      )}

      {/* Точечная волна поднимает второй WebGL-контекст — только после ухода интро. */}
      <Hero showWave={!introVisible} reducedMotion={reducedMotion} />

      <M5Section />

      <CircularGallery
        id="ring"
        ref={ringRef}
        items={items}
        onOpen={setActiveIndex}
        reducedMotion={reducedMotion}
      />

      <OrganizerSection />

      {active && <LotDetail lot={active} onClose={closeLot} />}
    </div>
  )
}
