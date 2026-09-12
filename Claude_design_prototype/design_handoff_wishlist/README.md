# Handoff: вишлист-обсерватория (одностраничный сайт)

## Overview

Одностраничный read-only вишлист, который автор один раз кидает ссылкой друзьям. Друг попадает на страницу, проходит короткое интро, читает hero, крутит скроллом кольцо желаний, открывает деталку лота и пишет автору в Telegram «беру». Между hero и кольцом стоит шутливый блок «Хочу такую повозку» (BMW M5 F90) с 3D-параллакс-галереей.

Главный результат — визуал и погружение. Функционально это статичный список из одного JSON.

## About the Design Files

Файлы в этом бандле — **дизайн-референс, собранный в HTML**. Это прототип, показывающий вид и поведение, а не продакшн-код для копирования.

Задача в целевом репозитории (**React + Vite + TypeScript + Tailwind + shadcn/ui**) — пересобрать эти экраны на его собственных паттернах: компоненты в `src/components/`, данные в `src/data/lots.json` + `src/data/lots.ts`, стили — Tailwind-классами и CSS-переменными, а не инлайн-стилями из прототипа. Инлайн-стили в HTML продиктованы средой прототипа и в проде должны стать Tailwind-утилитами или CSS-модулем.

Логику скролл-анимаций (`paintM5`, `paint`, `loop`) переносить можно почти буквально — она на чистом DOM/rAF и не зависит от React. Обёрнуть в `useEffect` + `useRef`.

## Fidelity

**High-fidelity.** Цвета, типографика, отступы, тайминги и копирайт финальные — воспроизводить точно. Исключения, требующие замены на реальные материалы:

- Фото лотов в `lots/*.jpeg` — сгенерированные заглушки 640×800. Нужны реальные фото товаров в том же 4:5.
- Фото BMW в `m5/*.jpeg` — 12 реальных фото, но обрезанных и приведённых к холодной гамме скриптом. При замене повторить обработку (см. «Assets»).

## Screens / Views

### 1. Интро (оверлей, играет один раз)

**Purpose.** Первое впечатление и «вход» в сцену; не несёт информации кроме одной строки.

**Layout.** `position: fixed; inset: 0; z-index: 90`, фон `#0c0f13`, флексом по центру. Внутри — полноэкранный `<canvas>` (WebGL, `position:absolute; inset:0`) и поверх него `<h1>`.

**Components.**
- Canvas-шейдер: концентрические расходящиеся круги. Фрагментный шейдер суммирует 4 синусоиды `sin(d*(24+i*8) - t*(2.6+i*0.7) + i*1.7)/(1+i)`, делит на 2.1, берёт `smoothstep(0.12,1.0,abs(w))`, множит на `exp(-d*1.45)`. Цвета: база `mix(#0c0f13, #171f29, fall)`, свет `#5aa7ea` (в шейдере `vec3(0.353,0.655,0.918)`), плюс ядро `beacon*0.22*exp(-d*7)`. DPR ограничен 1.6.
- `<h1>` «Смотри,<br>что я хочу» — Oswald 700, uppercase, `letter-spacing .02em`, `line-height .94`, `font-size: clamp(52px, 11vw, 168px)`, цвет `#f4f5f0`, `text-shadow: 0 0 40px rgba(12,15,19,.9)`. Единственная крупная типографика на весь экран во всём проекте.
- Кнопка «Пропустить вступление» — снизу по центру (`bottom:32px`), `#121212` фон, бордер `1px #2f2f2f`, radius 999px, padding `12px 26px`, 15px/500.

**Поведение.** Играет 2.3 с на десктопе, 1.5 с на мобиле, затем сама уходит. `localStorage['wl-intro-seen']='1'` — при возврате не играет. При `prefers-reduced-motion: reduce` не играет вообще. Уход: `opacity 0` + `scale(1.06)`, 700 ms `cubic-bezier(.2,.8,.2,1)`, затем полный `dispose()` WebGL и размонтирование. Пока интро на экране — `overflow:hidden` на `html` и `body`.

### 2. Hero

**Purpose.** Объяснить, что это за список и как им пользоваться.

**Layout.** `min-height: 100svh`, `display:grid; grid-template-rows: 1fr auto`. Фоном — `<canvas>` с точечной волной (`position:absolute; inset:0`), поверх радиальный градиент `radial-gradient(ellipse at 50% 120%, rgba(43,95,143,.35), rgba(18,18,18,0) 60%)`. Паддинги `clamp(24px,5vw,72px)`.

**Components.**
- Живая метка: точка 8×8, `#ff0000`, `box-shadow: 0 0 12px rgba(255,0,0,.8)` + текст «Список живой, я его правлю» 14px `#bfbfbf`. Единственное использование красного на странице.
- `<h1>` «Хочу<br>вот это» — Oswald 700 uppercase, `clamp(46px, 9.5vw, 148px)`, `line-height .92`. Появление: `wl-rise` 800 ms (`opacity 0→1`, `translateY(18px)→0`).
- Абзац-объяснение на плите: `#121212`, бордер `1px #2f2f2f`, radius 8, padding `20px 22px`, `max-width: 46ch`, текст `clamp(16px,1.5vw,19px)/1.55` `#f4f5f0`. Плита обязательна — она гарантирует контраст поверх анимации.
- Подсказка «Листай вниз» + `↓`, 14px `#bfbfbf`, стрелка анимирована `wl-cue` 2.2 s infinite (`translateY 0→7px`, `opacity .5→1`).

**Canvas точечной волны.** 2D-контекст, шаг сетки 24 px (десктоп) / 34 px (мобила). Для каждой точки: `wv = sin(x*0.011 + t)*9 + sin(y*0.017 - t*0.8)*7`, `depth = 1 - y/H`, `alpha = (0.10 + 0.32*depth) * (0.55 + 0.45*sin(x*0.011+t))`, радиус `1.1 + 1.5*depth`, цвет `rgba(140,195,242,alpha)`. `t += 0.016` за кадр. DPR ограничен 2.

### 3. Блок «Хочу такую повозку» (3D-параллакс-галерея)

**Purpose.** Шутка и одновременно смысловой мост к настоящему списку.

**Layout.** Секция `height: 300vh` с `data-m5-wrap`. Внутри `position:sticky; top:0; height:100svh`, фон `#121212`, `display:grid; grid-template-rows: auto minmax(0,1fr) auto`, `gap: clamp(14px,2vw,26px)`, padding `clamp(18px,3.5vw,44px) clamp(20px,5vw,72px) clamp(20px,4vw,52px)`.

**Ряд 1 — мета.** Слева точка `#8cc3f2` 8×8 с `box-shadow: 0 0 14px rgba(140,195,242,.8)` + «Вне конкурса» 14px `#f4f5f0`. Справа «BMW M5 · F90» 14px `#737373`.

**Ряд 2 — рамка галереи.** `overflow:hidden`, бордер `1px #2f2f2f`, radius 8, фон `#0e1116`. Внутри:
- слой перспективы: `position:absolute; inset:0; perspective:1000px; perspective-origin:50% 18%`;
- сетка (`data-m5-grid`): `position:absolute; top:-90%; bottom:-90%; left:50%; width:var(--m5-w); margin-left:calc(var(--m5-w)/-2)`, `display:grid; grid-template-columns:repeat(var(--m5-tracks),1fr)`, `gap: clamp(8px,1vw,16px)`, `transform-style:preserve-3d`. `--m5-w: 62%` и `--m5-tracks: 4` от 900px; ниже — `86%` / `2`;
- колонки (`data-col="0..3"`): `display:flex; flex-direction:column; gap: clamp(8px,1vw,16px)`, по 8 плиток;
- плитка: `<img>` без атрибутов `width`/`height` (важно: они перебивают `aspect-ratio`), `width:100%; height:auto; aspect-ratio:4/5; object-fit:cover; border-radius:8px; border:1px solid #2f2f2f; display:block`, `loading="lazy"`;
- поверх — виньетка `radial-gradient(ellipse at 50% 45%, rgba(14,17,22,0) 38%, rgba(14,17,22,.78) 100%)`.

Ниже 900px скрыты `[data-col="2"]` и `[data-col="3"]`.

**Ряд 3 — текст.** Грид `var(--m5-cols)` (`1.25fr .85fr` от 900px, иначе одна колонка), `gap: clamp(16px,3vw,44px)`, `align-items:end`.
- `<h2>` «Хочу такую повозку» — Oswald 700 uppercase, `clamp(34px,5.4vw,84px)`, `line-height .92`.
- Абзац «BMW M5 в кузове F90. Скидываться можно вдесятером, я не гордый — место у подъезда присмотрел, имя ей тоже придумал.» — `clamp(15px,1.4vw,18px)/1.55`, `#bfbfbf`, `max-width:46ch`.
- Правая колонка: «Но если вы вдруг хотите повременить с подарком, то вот тут есть ещё пожелания.» (`#f4f5f0`) + кнопка-ссылка «Открыть кольцо желаний» → `#ring`. Кнопка: `#f4f5f0` фон, `#121212` текст, radius 8, padding `13px 24px`, 15px/600, hover `opacity .82`.

### 4. Кольцо желаний

**Purpose.** Главный акт: все лоты висят в 3D-кольце, крутится от скролла.

**Layout.** Секция `#ring`, `height: 520vh`. Внутри `sticky; top:0; height:100svh; overflow:hidden`, `grid-template-rows: auto 1fr auto`.

**Ряд 1 — хедер кольца.** «Кольцо» Oswald 600 uppercase `letter-spacing .12em`, `clamp(13px,1.2vw,17px)`. Прогресс-бар: трек `#242424` 2px, `max-width:420px`, заливка `#8cc3f2` шириной `progress*100%`. Счётчик «01 / 10» 14px `#bfbfbf`, `min-width:6ch`, справа.

**Ряд 2 — сцена кольца.** Контейнер `perspective:1400px; perspective-origin:50% 45%`, `tabindex="0"`, `role="listbox"`. Внутри узел кольца `position:absolute; left:50%; top:48%; width:0; height:0; transform-style:preserve-3d`. Каждая плита — `<button role="option">`, `position:absolute; left:0; top:0`, внутри `<span>` с `width: var(--plate-w); aspect-ratio:4/5; margin-left: calc(var(--plate-w)/-2); margin-top: calc(var(--plate-w)*-0.625)`; фото `object-fit:cover; object-position: <imagePos>`. `--plate-w`: `clamp(140px,40vw,200px)` мобила, `clamp(170px,17vw,244px)` от 761px.

**Ряд 3 — подпись переднего лота.** Плита `#121212` + `1px #2f2f2f`, radius 8. `<h2>` с названием (Oswald 700 uppercase, `clamp(26px,4vw,52px)`), подзаголовок `clamp(14px,1.3vw,17px)` `#bfbfbf`, кнопка «Рассмотреть поближе» (`#f4f5f0`/`#121212`, radius 8, `13px 24px`, hover `opacity .82`).

### 5. Деталка лота (оверлей)

**Purpose.** Прочитать, зачем автору эта вещь, и написать «беру».

**Layout.** `position:fixed; inset:0; z-index:80`, скрим `rgba(8,10,13,.9)`, флекс по центру, padding `clamp(12px,3vw,40px)`. Панель `width:min(100%,940px)`, `max-height:100%`, `overflow:auto`, `#121212`, бордер `1px #2f2f2f`, radius 8, `grid-template-columns: var(--detail-cols)` (`0.9fr 1fr` от 860px, иначе одна колонка).

**Components.**
- Слева фото: `max-height:520px; object-fit:cover; object-position: <imagePos>`, разделитель `border-right: 1px solid #242424`.
- Категория — 13px/600, uppercase, `letter-spacing .08em`, `#8cc3f2` (берётся как часть `subtitle` до « · »).
- Кнопка закрытия — круг 36×36, бордер `1px #2f2f2f`, символ `×` 18px; получает фокус при открытии.
- `<h2>` — Oswald 700 uppercase `clamp(28px,3.4vw,48px)`.
- `note` — 17px/1.55 `#f4f5f0`.
- Цена: Oswald 600 26px + подпись «ориентир, а не цена» 14px `#bfbfbf`; блок обёрнут в `border-top`/`border-bottom` `1px #242424`, padding `14px 0`.
- CTA «Написать, что беру» — `<a>` на `https://t.me/<user>?text=<encodeURIComponent(...)>`, `#f4f5f0`/`#121212`, radius 8, `14px 26px`, 15px/600, `target="_blank" rel="noopener"`. Текст сообщения: `Привет! Беру «<title>» из твоего вишлиста.`
- Вторая ссылка «Посмотреть, что это» → `lot.url`, 15px `#8cc3f2`, рендерится только если `url` есть.

### 6. Футер

`<h2>` «Это всё кольцо» Oswald 700 uppercase `clamp(30px,5vw,72px)` + абзац «Ничего не обязательно. Напиши мне про любую вещь — договоримся на месте. А если хочешь подарить что-то своё, тем интереснее.» (`max-width:52ch`, `#bfbfbf`). Паддинги `clamp(56px,10vw,140px) clamp(20px,5vw,72px)`, сверху `1px solid #242424`.

## Interactions & Behavior

### Кольцо (scroll-driven)

```
span   = wrap.offsetHeight - viewportHeight
p      = clamp(-wrap.getBoundingClientRect().top / span, 0, 1)
rotTarget = -p * 360 * (n - 1) / n
rot   += (rotTarget - rot) * 0.12        // инерция; при reduced-motion rot = rotTarget
```

Для каждой плиты `i`:

```
a      = i * (360/n) + rot
near   = max(0, cos(a))
transform     = rotateY(a) translateZ(R)
opacity       = 0.16 + 0.84 * near^1.5
zIndex        = round(near * 100)
pointerEvents = near > 0.55 ? auto : none
boxShadow     = near > 0.8
                ? 0 0 (weight*12*(near-0.8)*5)px rgba(140,195,242, 0.10 + weight*0.07)
                : none
```

Радиус: `R = (plateW/2) / tan(π/n) * 1.42`, `plateW` берётся из реального `offsetWidth` плиты.

Передний элемент: `front = ((round(-rot / stepAngle) % n) + n) % n` — по его смене обновляются заголовок, подзаголовок, счётчик и `aria-selected`.

**Вес (`weight`)** выражается двумя способами: порядком (лоты сортируются `по убыванию weight`, кольцо встречает сильные желания первыми) и силой свечения передней плиты (формула выше). Бейджей приоритета нет.

### Галерея BMW (scroll-driven)

```
p  = clamp(-wrap.getBoundingClientRect().top / (wrap.offsetHeight - viewportHeight), 0, 1)
e  = p*p*(3 - 2*p)                       // smoothstep; при reduced-motion p = 0.55 (статика)

grid.transform = translate3d(0,0, (-120 + 120*e)px) scale(1.5 - 0.5*e) rotateX((58 - 58*e)deg)

для колонки i из n:
  dir     = i % 2 === 0 ? -1 : 1
  stagger = (i - (n-1)/2) * 70
  col.transform = translate3d(0, (stagger + dir*(1-e)*320)px, 0)
```

То есть плоскость начинается запрокинутой на 58°, увеличенной и отодвинутой, и разворачивается в ноль; колонки едут навстречу и садятся в шахматный сдвиг.

### Клавиатура и доступность

- Кольцо: `role="listbox"`, `tabindex="0"`. `←`/`↑` — предыдущий лот, `→`/`↓` — следующий (через программный скролл к нужной позиции), `Enter`/`Space` — открыть деталку. Плиты — `role="option"` с `aria-selected`.
- Фокус на плите автоматически доводит кольцо до неё (`onFocus` → `scrollToIndex`).
- Деталка: `role="dialog" aria-modal="true"`, закрывается по `Esc` и клику по скриму; при открытии фокус уходит на кнопку закрытия, при закрытии возвращается на плиту, с которой открыли (`focus({preventScroll:true})`).
- Видимый фокус: `:focus-visible { outline: 2px solid #8cc3f2; outline-offset: 3px }`.

### Бюджет WebGL

- Интро полностью размонтируется: `cancelAnimationFrame`, `deleteProgram`/`deleteShader`/`deleteBuffer`, затем `WEBGL_lose_context.loseContext()`. Без этого второй канвас упирается в лимит контекстов браузера.
- Канвас hero живёт за `IntersectionObserver` (`threshold: 0.01`): вне вьюпорта rAF отменяется, при возврате запускается снова.
- `prefers-reduced-motion: reduce`: интро не играет; точечная волна рисует один кадр и останавливается; кольцо идёт за скроллом без инерции; галерея BMW замирает в раскрытом состоянии (`p = 0.55`). Страница остаётся полноценной.
- Мобильные (≤760px): интро 1.5 с вместо 2.3; шаг точечной волны 34 px вместо 24; галерея BMW 2 колонки вместо 4; кольцо — без изменений, оно несёт смысл.
- Если резать производительность дальше — резать фон hero (в прототипе он вынесен в проп `showHeroWave`), кольцо не трогать.

### Прочее

- Скролл-контейнер определяется динамически (`overflowY: auto|scroll` и `scrollHeight > clientHeight`) — в проде это, скорее всего, `window`, но логика уже устойчива к обёрткам.
- Один общий `requestAnimationFrame`-цикл считает и галерею, и кольцо. Ре-байндить его надо через `() => this.loop()`, а не через сохранённую ссылку.
- Hover-переход у кнопок: `opacity 1 → .82`, 200 ms `cubic-bezier(.2,.8,.2,1)`.

## State Management

Без стейт-менеджера. Локально нужны:

- `lots: Lot[]` — импортируется статически из `src/data/lots.json`, сортируется по `weight` (desc) при инициализации.
- `active: Lot | null` — открытая деталка.
- `introVisible: boolean`, `introOut: boolean` — фазы интро.
- Вне React-стейта (в ref-ах, чтобы не перерисовывать на каждый кадр): `rot`, `rotTarget`, `front`, `progress`, `radius`, ссылки на DOM-узлы и id анимационных кадров.
- Персистентность: только `localStorage['wl-intro-seen']`.
- Данных с сервера нет, фетчей нет.

**Валидация данных.** Лот без `image` — дырка в кольце. В проде: сделать `image` обязательным в типе и добавить проверку на билде (или явный `console.error` со списком id и падение дев-сборки), а не тихо рендерить пустоту.

## Design Tokens

### Цвета

| Токен | Hex | Роль |
|---|---|---|
| void | `#121212` | канва страницы, плиты под текстом |
| shelf | `#171b21` | подложка под фото в кольце |
| stage | `#0e1116` | фон рамки галереи |
| curtain | `#0c0f13` | фон интро |
| deep | `#2b5f8f` | глубина градиента/шейдера |
| beacon | `#8cc3f2` | свет: ссылки, прогресс, свечение, фокус |
| smoke | `#f4f5f0` | текст и кнопки |
| signal | `#ff0000` | ровно один элемент — живая точка в hero |

Нейтрали из дизайн-системы: `#242424` (разделители), `#2f2f2f` (бордеры), `#737373`, `#979797`, `#bfbfbf` (вторичный текст).

### Типографика

- Display: **Oswald** 600/700, uppercase, `letter-spacing .02em`, `line-height .92–1.04`. Шкала: 168 / 148 / 116 / 84 / 72 / 52 / 48 / 32 px (через `clamp`).
- Body: **Onest** 400/500/600. Шкала: 19 / 18 / 17 / 15 / 14 / 13 px, `line-height 1.55`.
- Метки и uppercase-подписи: только там, где это часть системы (хедер кольца, категория в деталке). Моноспейса, разряженных ALL-CAPS эйброу и `→` в конце ссылок в дизайне нет — не добавлять.

### Прочее

- Скругления: 8px (плиты, кнопки, панели, плитки галереи), 999px (пилюли, точки).
- Бордеры: `1px solid #2f2f2f` в покое, `1px solid #242424` для разделителей.
- Отступы: шаг 4px; `clamp()`-паддинги секций `clamp(20px,5vw,72px)`.
- Тени: только свечение `0 0 Npx rgba(140,195,242, .10–.31)` на передних плитах кольца и `0 0 12–14px` под живыми точками. Обычных drop-shadow нет.
- Easing: `cubic-bezier(.2,.8,.2,1)`; длительности 200 / 260 / 400 / 700 / 800 ms; scroll-прогресс — `smoothstep`.

## Assets

- `lots/*.jpeg` (10 файлов, 640×800, ~33 КБ) — **сгенерированные заглушки**: холодная градиентная сцена + точечная сетка + абстрактный силуэт + грануляция. Заменить реальными фото товаров 4:5.
- `m5/*.jpeg` (12 файлов, 640×800, ~62 КБ) — реальные фото BMW M5 F90, предоставленные автором, обрезаны в 4:5 (crop по центру со сдвигом вверх на 45%) и приведены к сцене: `multiply` слоем `rgba(198,215,235,1)`, `overlay` радиальным `rgba(140,195,242,.20) → rgba(10,12,16,.32)`, снизу затемнение `linear-gradient(rgba(12,15,19,0) → rgba(12,15,19,.42))` от 50% высоты. При добавлении новых фото повторить эту обработку, иначе кадр выпадет из палитры.
- Шрифты: Oswald и Onest. Onest есть в дизайн-системе ChillBase (`fonts/`), Oswald — Google Fonts. В проде подключить локально, без внешних запросов на рендере.
- Иконок нет. Единственные графические элементы — точки-индикаторы и `×` в деталке.

## Files

- `Вишлист.dc.html` — единственный файл дизайна: разметка всех экранов + вся анимационная логика.
- `lots.json` — данные 10 демо-лотов (в проде → `src/data/lots.json`).
- `lots/` — заглушки фото лотов.
- `m5/` — фото BMW для галереи.

### Тип данных

```ts
type Lot = {
  id: string;
  title: string;
  subtitle: string;    // «Категория · ориентир 42 000 ₽» — до « · » берётся как тег в деталке
  note?: string;       // зачем мне это, моими словами
  price?: number;      // ориентир в рублях
  url?: string;        // где посмотреть
  image: string;       // обязателен: лот без фото — дырка в кольце
  imagePos?: string;   // object-position, например '65% 35%'
  weight: 1 | 2 | 3;   // выражается порядком и свечением, не бейджем
};
```

Поля `status: 'open' | 'taken'` в данных нет: выбор единичный, бронирования и «уже дарят» в дизайне убраны намеренно — не возвращать.

### Конфиг

Telegram-ник — одно значение (в прототипе проп `tgUser`, по умолчанию `username`). В проде — константа в конфиге, из неё строится ссылка `https://t.me/<user>?text=...`.

## Что осталось незакрытым

- Ник Telegram не задан — сейчас ссылка ведёт на `t.me/username`.
- Фото лотов — заглушки.
- 3D-галерея BMW воспроизводит эффект «unfurling gallery» с 21st.dev по описанию, а не портирована из исходника: код компонента на странице отдаётся скриптом и в этой среде недоступен. Если нужна точная копия — взять `Component.tsx` из таба Code и сверить углы, easing и раскладку с формулами выше.
