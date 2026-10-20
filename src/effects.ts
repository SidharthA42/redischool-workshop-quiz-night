// Sounds and confetti. Sounds are generated with the Web Audio API,
// so there are no sound files to download.

let audio: AudioContext | null = null

function tone(frequency: number, startAfter: number, duration: number, type: OscillatorType, volume: number) {
  if (!audio) return
  const start = audio.currentTime + startAfter
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  // Fade out quickly so the sound does not click.
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  oscillator.connect(gain).connect(audio.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

export type Sound = 'right' | 'wrong' | 'finish'

export function playSound(sound: Sound) {
  try {
    audio ??= new AudioContext()
    if (sound === 'right') {
      tone(660, 0, 0.15, 'triangle', 0.2)
      tone(880, 0.12, 0.25, 'triangle', 0.2)
    } else if (sound === 'wrong') {
      tone(200, 0, 0.18, 'square', 0.06)
      tone(150, 0.16, 0.3, 'square', 0.06)
    } else {
      // A short fanfare: C, E, G, high C.
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, i === 3 ? 0.5 : 0.18, 'triangle', 0.18))
    }
  } catch {
    // Audio is not available in this browser: stay silent.
  }
}

const CONFETTI_COLOURS = ['#ffc845', '#45d99a', '#ff7a7a', '#f4f2ff', '#8fa2ff']

export function launchConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  const pieces = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    speedX: (Math.random() - 0.5) * 4,
    speedY: 2 + Math.random() * 4,
    size: 6 + Math.random() * 6,
    angle: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
    colour: CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)],
  }))

  const startTime = performance.now()
  function frame(now: number) {
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of pieces) {
      p.x += p.speedX
      p.y += p.speedY
      p.speedY += 0.05 // gravity
      p.angle += p.spin
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.fillStyle = p.colour
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
    if (now - startTime < 4000) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
