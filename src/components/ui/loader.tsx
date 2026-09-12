/**
 * Modified Classic Loader — по мотивам 21st.dev, @mvp_Subha.
 * https://21st.dev/@mvp_Subha/components/loader
 *
 * Исходник закрыт: реестр отдаёт 404 по слагу, а на странице кода нет.
 * Собран по описанию «classic loader» из MVPBlocks: кольцо-трек с бегущей
 * дугой плюс встречная внутренняя дуга. Цвета — из палитры сцены.
 */
import { cn } from '@/lib/utils'

type LoaderProps = {
  /** Диаметр внешнего кольца в пикселях. */
  size?: number
  className?: string
  /** Текст для скринридера, пока идёт загрузка. */
  label?: string
}

export function Loader({ size = 56, className, label = 'Загрузка' }: LoaderProps) {
  const ring = 'absolute rounded-full border-2 border-transparent'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('relative inline-block', className)}
      style={{ width: size, height: size }}
    >
      {/* трек */}
      <span className="absolute inset-0 rounded-full border-2 border-line" />
      {/* внешняя дуга */}
      <span
        className={cn(ring, 'inset-0 animate-[wl-spin_900ms_linear_infinite] border-t-beacon')}
      />
      {/* встречная внутренняя дуга — та самая «modified» часть */}
      <span
        className={cn(
          ring,
          'animate-[wl-spin-rev_1400ms_linear_infinite] border-b-smoke/70',
        )}
        style={{ inset: size * 0.22 }}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}
