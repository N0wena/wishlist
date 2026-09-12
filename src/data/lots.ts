import type { Lot } from '@/types'
import raw from './lots.json'

const all = raw as Lot[]

const missingImage = all.filter((lot) => !lot.image).map((lot) => lot.id)

if (missingImage.length > 0) {
  const message = `[lots.json] лоты без image — в кольце будут дырки: ${missingImage.join(', ')}`
  console.error(message)
  if (import.meta.env.DEV) throw new Error(message)
}

/** Кольцо встречает сильные желания первыми — сортировка по убыванию weight. */
export const lots: Lot[] = all
  .filter((lot) => Boolean(lot.image))
  .sort((a, b) => b.weight - a.weight)
