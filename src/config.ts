/**
 * Единственное место, где живёт связь с автором.
 * TODO: подставить реальный ник — сейчас ссылка ведёт на t.me/username.
 */
export const TG_USER = 'username'

/** «Привет! Беру «<title>» из твоего вишлиста.» — текст, который уходит в Telegram. */
export function buildTelegramHref(title: string): string {
  const user = TG_USER.replace(/^@/, '')
  const text = `Привет! Беру «${title}» из твоего вишлиста.`
  return `https://t.me/${user}?text=${encodeURIComponent(text)}`
}
