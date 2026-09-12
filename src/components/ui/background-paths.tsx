/**
 * Background Paths — 21st.dev, @kokonutd.
 * https://21st.dev/@kokonutd/components/background-paths
 *
 * Статичная версия: вся анимация из промта снята по просьбе — и бегущие линии
 * (72 бесконечные SVG-анимации, они же были главным источником рывков),
 * и побуквенное проявление заголовка, и проявление кнопки, и всплывание кнопки
 * с уезжающей стрелкой на ховере. Остаётся картинка, у кнопки — только
 * затемнение заливки при наведении.
 *
 * Прочие отличия от промта:
 *  1. пропы `ctaLabel` / `onCta` — в промте подпись кнопки зашита строкой
 *     («Discover Excellence») и обработчика нет вовсе;
 *  2. палитра сцены вместо пары «светлая/тёмная»: сайт одно-темный, а `dark:`
 *     в Tailwind v4 завязан на prefers-color-scheme — при светлой теме ОС блок
 *     выехал бы белым посреди чёрной страницы;
 *  3. заголовок набран Oswald uppercase — дисплейной гарнитурой страницы.
 */
import { Button } from '@/components/ui/button'

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }))

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* xMidYMax — линии прижаты к низу кадра, чтобы не лезть под заголовок */}
      <svg
        className="h-full w-full text-smoke"
        viewBox="0 0 696 316"
        preserveAspectRatio="xMidYMax meet"
        fill="none"
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
          />
        ))}
      </svg>
    </div>
  )
}

export function BackgroundPaths({
  title = 'Background Paths',
  // Правка против промта: подпись и обработчик кнопки приходят пропами.
  ctaLabel = 'Discover Excellence',
  onCta,
}: {
  title?: string
  ctaLabel?: string
  onCta?: () => void
}) {
  return (
    <div className="relative flex min-h-screen w-full items-start justify-center overflow-hidden bg-void pt-[30vh]">
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center md:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-20 font-display text-[clamp(40px,7.5vw,112px)] leading-[0.92] font-bold tracking-[0.02em] text-smoke uppercase">
            {title}
          </h2>

          {/* Без всплывания и уезжающей стрелки из промта — только лёгкое
              затемнение заливки на ховере. */}
          <div className="relative inline-block overflow-hidden rounded-2xl bg-gradient-to-b from-smoke/25 to-void/10 p-px shadow-lg">
            <Button
              variant="ghost"
              onClick={onCta}
              className="rounded-[1.15rem] cursor-pointer border border-edge bg-void px-8 py-6 text-lg font-semibold text-smoke transition-colors duration-200 ease-wl hover:bg-curtain hover:text-smoke"
            >
              <span>{ctaLabel}</span>
              <span className="ml-3 opacity-70">→</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
