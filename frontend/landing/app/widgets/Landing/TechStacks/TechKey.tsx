import { motion, type TargetAndTransition, useAnimationControls } from 'motion/react'
import { type FC, useEffect } from 'react'

import Img from '~/Img'

import useSalon, { cn } from '../salon/tech_stacks/tech_key'

type TProps = {
  path?: string
  name: string
  desc?: string
  iconSize?: string
  active?: boolean
}

const CLICK_EFFECT: TargetAndTransition = {
  scale: [1, 0.95, 1],
  transition: { duration: 0.2, ease: 'easeOut' },
}

const TechKey: FC<TProps> = ({ path, name, desc = '', iconSize = 'size-6', active = false }) => {
  const s = useSalon({ active, name })
  const controls = useAnimationControls()

  const handleClick = () => {
    controls.start(CLICK_EFFECT)
  }

  useEffect(() => {
    if (active) {
      controls.start(CLICK_EFFECT)
    }
  }, [active, controls])

  return (
    <motion.div
      role='button'
      className={s.wrapper}
      animate={controls}
      onPointerDown={() => {
        handleClick()
        controls.start({ scale: 0.96 })
      }}
      onPointerUp={() => controls.start({ scale: 1 })}
      onPointerLeave={() => controls.start({ scale: 1 })}
    >
      <motion.div
        className={s.iconBox}
        animate={active ? { scale: [1, 1.2, 1] } : { scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <Img src={`landing/stacks/${path}`} className={cn(s.techIcon, iconSize)} />
      </motion.div>
      <div className={s.intro}>
        <span className={s.title}>{name}.</span>
        {desc}
      </div>
    </motion.div>
  )
}

export default TechKey
