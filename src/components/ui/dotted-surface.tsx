/**
 * Dotted Surface — 21st.dev, @efferd.
 * https://21st.dev/@efferd/components/dotted-surface
 *
 * Адаптация под хендофф вишлиста:
 *  - убран next-themes: сцена одно-темная, цвет точек приходит пропом (токен beacon);
 *  - размер берётся у контейнера (ResizeObserver), а не у окна — компонент живёт
 *    фоном секции, а не фиксированным слоем на весь экран;
 *  - DPR ограничен 2 и rAF отменяется вне вьюпорта — бюджет WebGL из хендоффа;
 *  - при prefers-reduced-motion рисуется один кадр;
 *  - id кадра держится в отдельном ref (в оригинале в sceneRef попадал undefined,
 *    и клинап отменял чужой кадр).
 */
'use client'

import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'> & {
  size?: number
  opacity?: number
  sizeAttenuation?: boolean
  /** Цвет точек. По умолчанию — beacon `#8cc3f2`. */
  color?: string
  /** Насколько дальний край поля гаснет: 0 — без градации, 1 — до нуля. */
  depthFade?: number
  /** Положение камеры [x, y, z]. Чем выше и ближе — тем сильнее наклон поля. */
  cameraPosition?: [number, number, number]
  /** Точка, в которую смотрит камера. */
  cameraTarget?: [number, number, number]
  /** Один кадр вместо цикла. */
  paused?: boolean
}

const SEPARATION = 150
const AMOUNTX = 40
const AMOUNTY = 60

export function DottedSurface({
  className,
  size = 8,
  opacity = 0.8,
  sizeAttenuation = true,
  color = '#8cc3f2',
  depthFade = 0.94,
  cameraPosition = [0, 900, 900],
  cameraTarget = [0, 0, -600],
  paused = false,
  ...props
}: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)

  const [camX, camY, camZ] = cameraPosition
  const [targetX, targetY, targetZ] = cameraTarget

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(60, 1, 1, 10000)
    camera.position.set(camX, camY, camZ)
    camera.lookAt(targetX, targetY, targetZ)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const positions: number[] = []
    const colors: number[] = []
    const base = new THREE.Color(color)

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        positions.push(
          ix * SEPARATION - (AMOUNTX * SEPARATION) / 2,
          0,
          iy * SEPARATION - (AMOUNTY * SEPARATION) / 2,
        )
        // Глубина по хендоффу: дальний край поля гаснет, ближний светится.
        const depth = iy / (AMOUNTY - 1)
        const fade = 1 - depthFade * (1 - depth)
        colors.push(base.r * fade, base.g * fade, base.b * fade)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity,
      sizeAttenuation,
      depthWrite: false,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const resize = () => {
      const w = container.clientWidth || 1
      const h = container.clientHeight || 1
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(container)

    let count = 0
    const positionAttribute = geometry.attributes.position as THREE.BufferAttribute
    const buffer = positionAttribute.array as Float32Array

    const render = () => {
      let i = 0
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          buffer[i * 3 + 1] =
            Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50
          i++
        }
      }
      positionAttribute.needsUpdate = true
      renderer.render(scene, camera)
      count += 0.1
    }

    const loop = () => {
      render()
      frameRef.current = requestAnimationFrame(loop)
    }

    const stop = () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
      }
    }

    const start = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(loop)
    }

    let visibility: IntersectionObserver | null = null
    if (paused) {
      render()
    } else {
      start()
      // Вне вьюпорта кадры не считаем.
      visibility = new IntersectionObserver(
        (entries) => (entries[0].isIntersecting ? start() : stop()),
        { threshold: 0.01 },
      )
      visibility.observe(container)
    }

    return () => {
      stop()
      visibility?.disconnect()
      observer.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      // На странице второй WebGL-контекст (интро) — освобождаем слот явно.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
    // Камера разложена на примитивы: массив-литерал в пропах пересоздавал бы
    // сцену на каждый рендер.
  }, [size, opacity, sizeAttenuation, color, depthFade, paused, camX, camY, camZ, targetX, targetY, targetZ])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      {...props}
    />
  )
}

export default DottedSurface
