import { motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { COLOR } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import ArrowLinker from '~/widgets/ArrowLinker'

import useSalon from '../salon/tech_stacks/keyboard'
import HolderKey from './HolderKey'
import TechKey from './TechKey'

const STAGING_TIME = 200
const TECH_TOTAL = 10

export default function Keyboard() {
  const s = useSalon()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: false, margin: '-20% 0px' })
  const [state, setState] = useState({
    activeCount: 0,
    showLight: false,
  })
  const { activeCount, showLight } = state

  const { isDarkTheme } = useTheme()
  const { t } = useTrans()

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    if (isDarkTheme && inView) {
      timer = setTimeout(() => {
        setState((prev) => (prev.showLight ? prev : { ...prev, showLight: true }))
      }, 500)
    } else {
      setState((prev) => (prev.showLight ? { ...prev, showLight: false } : prev))
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [inView, isDarkTheme])

  useEffect(() => {
    if (!inView) return
    const timers: NodeJS.Timeout[] = []

    for (let i = 0; i < TECH_TOTAL; i++) {
      const count = i + 1
      timers.push(
        setTimeout(() => setState((prev) => ({ ...prev, activeCount: count })), i * STAGING_TIME),
      )
    }
    return () => {
      for (const timer of timers) {
        clearTimeout(timer)
      }
    }
  }, [inView])

  return (
    <div ref={ref} className={s.wrapper}>
      {isDarkTheme && (
        <>
          <motion.div
            initial={{
              clipPath: 'inset(0 100% 0 0)',
              opacity: 0,
            }}
            animate={{
              clipPath: showLight ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
              opacity: showLight ? 0.4 : 0,
            }}
            transition={{
              clipPath: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.1 },
            }}
            className={s.lightBlob}
          />
          <motion.div
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{
              clipPath: showLight ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)',
              opacity: showLight ? 1 : 0,
            }}
            transition={{
              clipPath: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.25 },
            }}
            className={s.lightGlow}
          />
        </>
      )}

      <div className={s.banner}>
        <div className={s.title}>{t('landing.tech.keyboard.title')}</div>
        <div className={s.desc}>{t('landing.tech.keyboard.desc')}</div>
      </div>

      <div className={s.techs}>
        <div className='row-center gap-x-1'>
          <HolderKey name='1' prefix='!' />
          <HolderKey name='2' prefix='@' />
          <HolderKey name='3' prefix='#' />
          <HolderKey name='4' prefix='$' />
          <HolderKey name='5' prefix='%' />
          <HolderKey name='6' prefix='^' />
          <HolderKey name='7' prefix='&' />
          <HolderKey name='8' prefix='*' />
          <HolderKey name='9' prefix='(' />
          <HolderKey name='0' prefix=')' />
        </div>

        <div className='row-center gap-x-2'>
          <HolderKey name='' prefix='Tab' />
          <HolderKey name='W' prefix='' />
          <TechKey
            path='elixir.png'
            name='Elixir'
            desc='backend language'
            active={activeCount >= 1}
          />

          <TechKey path='react.png' name='React' desc='UI interface' active={activeCount >= 2} />
          <HolderKey name='U' prefix='' />
          <HolderKey name='O' prefix='' />
          <TechKey
            path='phoenix.png'
            name='Phoenix'
            desc='backend framework'
            active={activeCount >= 3}
          />
          <HolderKey name='|\' prefix='' />
        </div>

        <div className='row-center gap-x-2'>
          <HolderKey name='' prefix='Shift' className='-ml-10 w-32 items-center' />
          <TechKey
            path='graphql.png'
            name='GraphQL'
            desc='API endpoints'
            iconSize='size-5'
            active={activeCount >= 8}
          />
          <TechKey
            path='nextjs.png'
            name='Next.js'
            desc='web framework'
            iconSize='size-12'
            active={activeCount >= 5}
          />
          <HolderKey name='F' prefix='' />
          <TechKey path='pg.png' name='PostgreSQL' desc='main database' active={activeCount >= 6} />
          <TechKey
            path='typescript.png'
            name='TypeScript'
            desc='frontend language'
            iconSize='size-5'
            active={activeCount >= 7}
          />
          <HolderKey name='' prefix='Enter' className='w-36' />
        </div>

        <div className='row-center gap-x-2'>
          <HolderKey name='' prefix='Ctrl' />
          <TechKey
            path='slate.png'
            name='Slate'
            desc='rich text editor'
            iconSize='size-5'
            active={activeCount >= 4}
          />
          <HolderKey name='V' prefix='' />
          <TechKey
            path='tailwind.png'
            name='TailwindCSS'
            desc='for UI styling'
            iconSize='size-9'
            active={activeCount >= 9}
          />
          <HolderKey name='M' prefix='' />
          <TechKey
            path='notes.png'
            name='Notes'
            desc='project management'
            active={activeCount >= 1}
          />
          <HolderKey name='<' prefix='' />
          <HolderKey name='>' prefix='' />
        </div>
      </div>
      <div className={s.bottom}>
        <span className={s.detail}>{t('landing.tech.keyboard.detail')}</span>
        <ArrowLinker href='/' color={COLOR.PURPLE} className='pl-0.5'>
          {t('landing.tech.keyboard.link')}
        </ArrowLinker>
      </div>
    </div>
  )
}
