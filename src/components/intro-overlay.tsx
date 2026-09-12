/**
 * Интро: концентрические расходящиеся круги на WebGL. Играет при каждом заходе,
 * ничего не запоминает; при reduced-motion не играет вовсе.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const OUT_MS = 700

const VERTEX_SHADER = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }'

const FRAGMENT_SHADER = [
  'precision mediump float;',
  'uniform vec2 u_res; uniform float u_t;',
  'void main(){',
  '  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / min(u_res.x,u_res.y);',
  '  float d = length(uv);',
  '  float w = 0.0;',
  '  for(int i=0;i<4;i++){ float fi=float(i);',
  '    w += sin(d*(24.0+fi*8.0) - u_t*(2.6+fi*0.7) + fi*1.7) / (1.0+fi); }',
  '  w /= 2.1;',
  '  float ring = smoothstep(0.12, 1.0, abs(w));',
  '  float fall = exp(-d*1.45);',
  '  vec3 base = mix(vec3(0.047,0.059,0.075), vec3(0.09,0.12,0.16), fall);',
  '  vec3 beacon = vec3(0.353,0.655,0.918);',
  '  vec3 col = base + beacon*ring*fall*0.85 + beacon*0.22*exp(-d*7.0);',
  '  gl_FragColor = vec4(col,1.0);',
  '}',
].join('\n')

type IntroOverlayProps = {
  /** Сколько держать интро до автоматического ухода. */
  holdMs: number
  /** Интро полностью размонтировано — можно поднимать второй WebGL-контекст. */
  onDone: () => void
}

export function IntroOverlay({ holdMs, onDone }: IntroOverlayProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)
  const outTimerRef = useRef(0)

  const dismiss = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    outTimerRef.current = window.setTimeout(onDone, OUT_MS)
  }, [onDone])

  // Канвас создаётся здесь, а не в JSX, и выбрасывается в клинапе. Это важно:
  // контекст WebGL кешируется на элементе, а на выходе мы зовём loseContext()
  // ради лимита контекстов. Переиспользуй мы один и тот же <canvas>, повторный
  // getContext вернул бы тот же — уже потерянный — контекст, и шейдер бы не рисовал.
  // В деве это ловится сразу: StrictMode прогоняет эффект дважды.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const canvas = document.createElement('canvas')
    canvas.style.cssText =
      'position:absolute; inset:0; width:100%; height:100%; display:block'
    host.appendChild(canvas)

    const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'low-power' })
    if (!gl) {
      canvas.remove()
      return
    }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return shader
    }

    const vsh = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fsh = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    const program = gl.createProgram()!
    gl.attachShader(program, vsh)
    gl.attachShader(program, fsh)
    gl.linkProgram(program)
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(program, 'u_res')
    const uTime = gl.getUniformLocation(program, 'u_t')

    const start = performance.now()
    let frame = 0

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6)
      const w = Math.floor(canvas.clientWidth * dpr)
      const h = Math.floor(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
      gl.uniform1f(uTime, (performance.now() - start) / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      frame = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(frame)
      gl.deleteProgram(program)
      gl.deleteShader(vsh)
      gl.deleteShader(fsh)
      gl.deleteBuffer(buffer)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    }
  }, [])

  // Пока интро на экране — страница не скроллится.
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const holdTimer = window.setTimeout(dismiss, holdMs)
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(outTimerRef.current)
    }
  }, [holdMs, dismiss])

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center bg-curtain transition-[opacity,transform] duration-700 ease-wl"
      style={leaving ? { opacity: 0, transform: 'scale(1.06)' } : undefined}
    >
      <div ref={hostRef} aria-hidden="true" className="absolute inset-0" />
      <h1 className="relative m-0 px-6 text-center font-display text-[clamp(52px,11vw,168px)] leading-[0.94] font-bold tracking-[0.02em] text-smoke uppercase [text-shadow:0_0_40px_rgba(12,15,19,.9)]">
        Смотри,
        <br />
        что я хочу
      </h1>
      <button
        type="button"
        onClick={dismiss}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer rounded-full border border-edge bg-void px-[26px] py-3 text-[15px] font-medium tracking-[0.01em] text-smoke"
      >
        Пропустить вступление
      </button>
    </div>
  )
}
