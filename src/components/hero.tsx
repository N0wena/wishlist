import { lazy, Suspense } from 'react'

// three.js уезжает в отдельный чанк: волна — фон, ради неё не стоит держать
// полмегабайта в основном бандле.
const DottedSurface = lazy(() =>
  import('@/components/ui/dotted-surface').then((m) => ({ default: m.DottedSurface })),
)

type HeroProps = {
  /** Точечная волна поднимается только после того, как интро освободило WebGL. */
  showWave?: boolean
  reducedMotion?: boolean
}

export function Hero({ showWave = true, reducedMotion = false }: HeroProps) {
  return (
    <header className="relative grid min-h-[100svh] grid-rows-[1fr_auto] overflow-hidden">
      {showWave && (
        <Suspense fallback={null}>
          <DottedSurface paused={reducedMotion} size={7} opacity={0.8} />
        </Suspense>
      )}
      {/* Дальний край поля растворяется в фоне — горизонта у сцены нет. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #121212 0%, rgba(18,18,18,0) 34%),' +
            'radial-gradient(ellipse at 50% 120%, rgba(43,95,143,.35), rgba(18,18,18,0) 60%)',
        }}
      />

      <div className="relative flex items-end p-[clamp(24px,5vw,72px)] pb-0">
        <div className="max-w-[920px] animate-wl-rise">
          <h1 className="m-0 font-display text-[clamp(46px,9.5vw,148px)] leading-[0.92] font-bold tracking-[0.02em] text-smoke uppercase">
            Хочу
            <br />
            Такую повозку
          </h1>
        </div>
      </div>

      <div className="relative flex flex-wrap items-end gap-6 p-[clamp(24px,5vw,72px)]">
        {/* Плита обязательна — она гарантирует контраст поверх анимации. */}
        <p className="m-0 max-w-[46ch] rounded-plate border border-edge bg-void px-[22px] py-5 text-[clamp(16px,1.5vw,19px)] leading-[1.55] text-pretty text-smoke">
            BMW M5 в кузове F90. Место на парковке
            присмотрел, имя ей тоже придумал.
        </p>
      </div>
    </header>
  )
}
