import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { COLOR } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import ArrowLinker from '~/widgets/ArrowLinker'
import useSalon from '../salon/tech_stacks/keyboard'
import HolderKey from './HolderKey'
import TechKey from './TechKey'

const TECH_TOTAL = 10

export default function Keyboard() {
  const s = useSalon()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: false, margin: '-20% 0px' })
  const { isDarkTheme } = useTheme()
  const lightOn = isDarkTheme && inView
  const activeCount = inView ? TECH_TOTAL : 0

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
              clipPath: lightOn ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
              opacity: lightOn ? 0.4 : 0,
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
              clipPath: lightOn ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)',
              opacity: lightOn ? 1 : 0,
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
        <div className={s.title}>开源技术栈</div>
        <div className={s.desc}>由久经考验的开源技术栈驱动，并持续跟进业界最佳实践。</div>
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
          <HolderKey name='' prefix='Shift' className='items-center w-32 -ml-10' />
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
        <span className={s.detail}>关于技术选型与架构的更多细节，请</span>
        <ArrowLinker href='/' color={COLOR.PURPLE} className='pl-0.5'>
          参考这里
        </ArrowLinker>
      </div>
    </div>
  )
}
