'use client'

import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'

import useMount from '~/hooks/useMount'
import useTrans from '~/hooks/useTrans'
import { SegmentTabs } from '~/widgets/Switcher'
import ThemeSwitchPreview from '~/widgets/ThemeSwitch/Preview'

import SectionLabel from '../../SectionLabel'
import { TAB, TAB_OPTIONS } from './constant'
import GradientTab from './GradientTab'
import LogicProvider from './LogicProvider'
import PicturesTab from './PicturesTab'
import PreviewPanel from './PreviewPanel'
import useSalon from './salon'
import UploadTab from './UploadTab'
import useLogic from './useLogic'

const TAB_TRANSITION = {
  duration: 0.18,
  ease: [0.16, 1, 0.3, 1],
} as const

const TAB_ANIMATION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
} as const

function Wallpaper() {
  const s = useSalon()
  const { t } = useTrans()
  const { tab, changeTab, initRollback, isTouched } = useLogic()
  const tabItems = TAB_OPTIONS.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))

  useMount(initRollback)

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.wallpaper.title')}
        desc={t('dsb.appearance.wallpaper.desc')}
        addon={<ThemeSwitchPreview />}
        touched={isTouched}
      />

      <PreviewPanel />

      <div className={s.editor}>
        <SegmentTabs
          items={tabItems}
          activeKey={tab}
          onChange={(key) => changeTab(key as typeof tab)}
          left={-1}
          bottom={5}
        />

        <LazyMotion features={domAnimation}>
          <AnimatePresence initial={false} mode='wait'>
            <m.div
              key={tab}
              className={s.editorContent}
              initial={TAB_ANIMATION.initial}
              animate={TAB_ANIMATION.animate}
              exit={TAB_ANIMATION.exit}
              transition={TAB_TRANSITION}
            >
              {tab === TAB.PICTURES && <PicturesTab />}
              {tab === TAB.GRADIENT && <GradientTab />}
              {tab === TAB.UPLOAD && <UploadTab />}
            </m.div>
          </AnimatePresence>
        </LazyMotion>
      </div>
    </div>
  )
}

export default LogicProvider(Wallpaper)
