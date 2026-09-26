import { useRef, type JSX, type RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import type { BoothStage } from '../types'

gsap.registerPlugin(useGSAP)

interface KioskMotionProps {
  level: 'low' | 'medium' | 'high'
  scope: RefObject<HTMLElement | null>
  stage: BoothStage
}

export function KioskMotion({ level, scope, stage }: KioskMotionProps): JSX.Element | null {
  const previousStage = useRef(stage)

  useGSAP(() => {
    const changedStage = previousStage.current !== stage
    previousStage.current = stage
    if (level === 'low' || stage === 'slot-capture') return

    const media = gsap.matchMedia()
    media.add({ reduced: '(prefers-reduced-motion: reduce)' }, context => {
      if (context.conditions?.reduced) return
      if (level === 'high') {
        gsap.set('.ambient-orb', { autoAlpha: 0.9 })
        gsap.to('.orb-one', { x: 18, y: 24, duration: 5.2, ease: 'sine.inOut', repeat: -1, yoyo: true })
        gsap.to('.orb-two', { x: -16, y: -20, duration: 6.4, ease: 'sine.inOut', repeat: -1, yoyo: true })
      }
      if (stage === 'idle') {
        gsap.from('.welcome-reveal', {
          autoAlpha: 0,
          y: level === 'high' ? 34 : 18,
          duration: level === 'high' ? 0.72 : 0.42,
          stagger: level === 'high' ? 0.075 : 0.035,
          ease: 'power3.out'
        })
      }
      if (changedStage) {
        gsap.fromTo('.app-stage', { autoAlpha: 0, y: level === 'high' ? 18 : 10 }, { autoAlpha: 1, y: 0, duration: level === 'high' ? 0.58 : 0.38, ease: 'power3.out' })
      }
    })
    return () => media.revert()
  }, { scope, dependencies: [stage, level], revertOnUpdate: true })

  return null
}
