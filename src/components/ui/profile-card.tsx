/**
 * Profile Card — по мотивам 21st.dev, @isaiahbjork.
 * https://21st.dev/@isaiahbjork/components/profile-card
 *
 * Исходник закрыт авторизацией реестра (403). Собран по описанию со страницы:
 * «layered blur effects, animated reveal of bio/stats, motion-enhanced name
 * rendering (letter-by-letter), interactive follow button». Палитра — сцены.
 */
'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type ProfileCardProps = {
  name: string
  /** Ник со собачкой, например `@iamokaythankyou`. */
  handle: string
  avatar: string
  bio?: string
  /** Подпись и ссылка кнопки действия. */
  actionLabel: string
  actionHref: string
  className?: string
}

export function ProfileCard({
  name,
  handle,
  avatar,
  bio,
  actionLabel,
  actionHref,
  className,
}: ProfileCardProps) {
  const letters = Array.from(name)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        'relative w-[min(100%,570px)] overflow-hidden rounded-2xl border border-edge bg-void',
        className,
      )}
    >
      {/* слоистые блики: размытое фото шапкой + свечение beacon поверх */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-56 overflow-hidden">
        <img src={avatar} alt="" className="h-full w-full scale-125 object-cover blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-beacon/15 via-void/70 to-void" />
      </div>

      <div className="relative flex flex-col items-center px-10 pt-14 pb-10 text-center">
        <motion.img
          src={avatar}
          alt={name}
          width={168}
          height={168}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          className="h-[168px] w-[168px] rounded-full border border-edge object-cover shadow-[0_0_48px_rgba(140,195,242,.22)]"
        />

        {/* имя проявляется по буквам */}
        <h3 className="mt-7 font-display text-[46px] leading-none font-bold tracking-[0.02em] text-smoke uppercase">
          {letters.map((letter, i) => (
            <motion.span
              key={i}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.04, type: 'spring', stiffness: 180, damping: 22 }}
              className="inline-block"
            >
              {letter === ' ' ? ' ' : letter}
            </motion.span>
          ))}
        </h3>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-3 text-[17px] text-beacon"
        >
          {handle}
        </motion.p>

        {bio && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.4 }}
            className="mt-5 max-w-[32ch] text-[17px] leading-[1.55] text-pretty text-soft"
          >
            {bio}
          </motion.p>
        )}

        <motion.a
          href={actionHref}
          target="_blank"
          rel="noopener"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.46, duration: 0.4 }}
          className="mt-8 w-full rounded-plate border-b-0 bg-smoke px-6 py-4 text-[17px] font-semibold text-void transition-opacity duration-200 ease-wl hover:border-b-0 hover:text-void hover:opacity-[0.82]"
        >
          {actionLabel}
        </motion.a>
      </div>
    </motion.div>
  )
}
