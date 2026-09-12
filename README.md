# Вишлист-обсерватория

Одностраничный read-only вишлист: интро-шейдер → hero → блок «Хочу такую повозку» (BMW M5 F90) →
кольцо желаний → деталка лота → футер. Друг открывает ссылку, крутит кольцо скроллом и пишет
в Telegram «беру».

Стек: **React 19 + Vite + TypeScript + Tailwind v4 + структура shadcn/ui**.

## Команды

```bash
npm run dev        # дев-сервер
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b --noEmit
npm run lint       # oxlint
npm run preview    # предпросмотр сборки
```

## Структура

```
src/
  App.tsx                   состояние: активный лот + фаза интро, больше ничего
  config.ts                 Telegram-ник и сборка ссылки «беру»
  types.ts                  тип Lot
  data/lots.json            единственный источник данных (10 лотов)
  data/lots.ts              валидация + сортировка по убыванию weight
  data/m5-shots.ts          раскладка 12 кадров BMW по 4 колонкам
  components/               экраны: intro-overlay, hero, m5-section, organizer-section, lot-detail
                            интро играет при каждом заходе, ничего не сохраняет
  components/ui/            компоненты-эффекты (см. ниже)
  hooks/use-media-flags.ts  reduced-motion и мобильный брейкпоинт
public/{lots,m5,fonts}/     фото лотов, фото BMW, локальные Oswald и Onest
```

Дизайн-референс лежит в `Claude_design_prototype/design_handoff_wishlist/` — это прототип,
собранный в HTML, а не код для копирования. Токены, копирайт, тайминги и формулы анимаций
берутся из его `README.md`.

## Компоненты-эффекты

| Файл | Источник |
|---|---|
| `ui/dotted-surface.tsx` | [21st.dev @efferd](https://21st.dev/@efferd/components/dotted-surface) — three.js, адаптирован |
| `ui/3d-parallax-unfurling-gallery.tsx` | [21st.dev @piyushxdev](https://21st.dev/@piyushxdev/components/3d-parallax-unfurling-gallery) — framer-motion, код из промта; три помеченных отличия |
| `ui/circular-gallery.tsx` | собран по формулам хендоффа: исходник [21st.dev @ravikatiyar162](https://21st.dev/@ravikatiyar162/components/circular-gallery) закрыт авторизацией реестра |

Правки к компонентам 21st.dev перечислены в шапке каждого файла.

Параллакс-галерея стоит на странице дважды:

- блок «Хочу такую повозку» — `images={m5Shots} scrollMode="page" scrollLength="300vh"`:
  прогресс от скролла документа, sticky-экран на всю высоту, своего overflow-контейнера нет;
- эталонный блок в самом низу — без пропов: режим `self` из промта, со своим скроллом
  и картинками с cdn.21st.dev.

Отступления от хендоффа в блоке BMW (следствие решения взять компонент 21st как есть):
мета и текст стоят до и после галереи, а не в общем sticky-гриде; нет заморозки при
`prefers-reduced-motion` и нет перехода на две колонки ниже 900px.

## Что осталось подставить

- **Telegram-ник** — `TG_USER` в `src/config.ts`, сейчас заглушка `username`.
- **Фото лотов** — `public/lots/*.jpeg` сгенерированные заглушки 640×800. Заменяются файлами
  в том же кадрировании 4:5, код трогать не нужно.
- Фото BMW: исходники в `assets-src/m5/`, готовые — в `public/m5/`. Новые прогонять скриптом
  `python3 assets-src/grade_m5.py assets-src/m5 public/m5 0` (кроп 4:5 со сдвигом вверх на 45%
  и ресайз в 640×800). Последний аргумент — сила холодного грейдинга из хендоффа: сейчас 0,
  потому что блок собран на компоненте 21st и кадры идут в своих цветах.
