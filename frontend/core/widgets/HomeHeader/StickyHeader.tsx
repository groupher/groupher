import { type MotionValue, motion, useScroll } from 'motion/react'
import Link from 'next/link'
import { type FC, useEffect, useState } from 'react'

import { ROUTE } from '~/const/route'
import useSession from '~/hooks/useSession'
import Button from '~/widgets/Buttons/Button'
import ThemeSwitch from '~/widgets/ThemeSwitch'

import IntroLinks from './IntroLinks'
import useSalon, { cn } from './salon'

type TProps = {
  maxWidth: string | MotionValue<string>
}

const STICKY_AT = 1200

const HomeHeader: FC<TProps> = ({ maxWidth }) => {
  const { scrollY } = useScroll()
  const [sticky, setSticky] = useState(false)

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (y) => {
      setSticky(y > STICKY_AT)
    })
    return () => unsubscribe()
  }, [scrollY])

  const s = useSalon()

  useSession()

  return (
    <motion.header
      className={s.stickyWrapper}
      initial={{ opacity: 0, y: -30, scale: 0.92 }}
      animate={sticky ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0 }}
      transition={
        sticky ? { type: 'spring', stiffness: 200, damping: 24, mass: 0.6 } : { duration: 0.3 }
      }
      style={{ maxWidth }}
    >
      <IntroLinks />
      <div className={s.extraInfo}>
        <ThemeSwitch />
        <div className={s.divider} />
        <Link className={cn(s.requestDemoLink, 'scale-90')} href={`/${ROUTE.APPLY_COMMUNITY}`}>
          <Button space={3} className='bold-sm'>
            <span className='relative flex size-3 mr-2.5 brightness-125 scale-75'>
              <span className='absolute inline-flex w-full h-full rounded-full opacity-80 animate-ping bg-rainbow-purpleSoft'></span>
              <span className='relative inline-flex rounded-full size-3 bg-rainbow-purple'></span>
            </span>
            开始使用
          </Button>
        </Link>
      </div>
    </motion.header>
  )
}

export default HomeHeader
