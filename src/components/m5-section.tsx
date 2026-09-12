import ParallaxUnfurlingGallery from '@/components/ui/3d-parallax-unfurling-gallery'
import { m5Shots } from '@/data/m5-shots'

/**
 * «Хочу такую повозку» — шутка и одновременно смысловой мост к настоящему списку.
 *
 * Галерея идёт в режиме `scrollMode="page"`: прогресс считается от скролла
 * документа, сама она залипает на весь экран. Собственного overflow-контейнера
 * у неё нет — иначе колесо двигало бы галерею только под курсором, а мимо неё
 * листалась бы страница и блок можно было проскочить.
 */
export function M5Section() {
  return (
    <section
      aria-label="Главное желание — BMW M5 F90"
      className="relative border-t border-line bg-void"
    >
      <div className="flex items-center justify-between gap-4 px-[clamp(20px,5vw,72px)] py-[clamp(18px,3.5vw,44px)]">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-beacon shadow-[0_0_14px_rgba(140,195,242,.8)]" />
          <span className="text-sm text-smoke">Вне конкурса</span>
        </div>
        <span className="text-sm text-mute">BMW M5 · F90</span>
      </div>

      <ParallaxUnfurlingGallery images={m5Shots} scrollMode="page" scrollLength="300vh" />

      {/* Мостик к кольцу: стрелка указывает на список, который идёт следом. */}
      <div className="flex flex-wrap items-center gap-3 px-[clamp(20px,5vw,72px)] py-[clamp(18px,3.5vw,44px)] text-sm text-soft">
        <span>Но если вы вдруг хотите повременить с подарком, то вот тут есть ещё пожелания.</span>
        <span aria-hidden="true" className="inline-block animate-wl-cue">
          ↓
        </span>
      </div>
    </section>
  )
}
