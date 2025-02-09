import { confetti } from 'tsparticles-confetti'

/**
 * finish tada effect
 */
export const tada = () => {
  const defaults = {
    spread: 360,
    ticks: 100,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
  }

  function shoot() {
    confetti({
      ...defaults,
      particleCount: 20,
      scalar: 1.2,
      shapes: ['circle', 'square', 'heart'],
      colors: ['#F8D678', '#F5C5C8', '#BDA3F0', '#C9D8FD', '#DCF8FD'],
    })

    confetti({
      ...defaults,
      particleCount: 20,
      scalar: 1.8,
      shapes: ['text'],
      shapeOptions: {
        text: {
          value: ['🦄', '🌈'],
        },
      },
    })
  }

  setTimeout(shoot, 0)
  setTimeout(shoot, 100)
}

export const holder = 1
