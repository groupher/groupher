import { includes } from 'ramda'
import type { FC } from 'react'
import { COLOR } from '~/const/colors'
import { THREAD } from '~/const/thread'
import useTrans from '~/hooks/useTrans'
import IntroArrowSVG from '~/icons/IntroArrow'
import IntroSpinSVG from '~/icons/IntroSpin'
import type { TThread } from '~/spec'
import useSalon, { cn, ICON } from '../salon/articles_intro_tabs/tabs'
import PreviewBars from './PreviewBars'

type TProps = {
  tab: TThread
  onChange: (tab: TThread) => void
}
const Tabs: FC<TProps> = ({ tab, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()
  const TAB_ITEMS = [
    {
      key: THREAD.POST,
      title: t('landing.articles.tab.post.title'),
      desc: t('landing.articles.tab.post.desc'),
      color: COLOR.PURPLE,
    },
    {
      key: THREAD.KANBAN,
      title: t('landing.articles.tab.kanban.title'),
      desc: t('landing.articles.tab.kanban.desc'),
      color: COLOR.BLUE,
    },
    {
      key: THREAD.CHANGELOG,
      title: t('landing.articles.tab.changelog.title'),
      desc: t('landing.articles.tab.changelog.desc'),
      color: COLOR.RED,
    },
    {
      key: THREAD.DOC,
      title: t('landing.articles.tab.doc.title'),
      desc: t('landing.articles.tab.doc.desc'),
      color: COLOR.CYAN,
    },
  ]

  return (
    <div className={s.wrapper}>
      {tab === THREAD.KANBAN && <IntroArrowSVG className={cn(s.arrowIcon, s.fillBlue)} />}

      {TAB_ITEMS.map((item) => {
        const color = item.color.toLowerCase()
        const active = item.key === tab
        const CurIcon = ICON[item.key]

        return (
          <button
            key={item.key}
            type='button'
            className={cn(s.tabItem, active && s.tabActive, active && s[`${color}Border`])}
            onClick={() => onChange(item.key as TThread)}
          >
            {item.key === THREAD.KANBAN &&
              includes(tab, [THREAD.KANBAN, THREAD.CHANGELOG, THREAD.DOC]) && (
                <IntroArrowSVG className={cn(s.arrowIcon, s.fillBlue, active && 'opacity-80')} />
              )}

            {item.key === THREAD.CHANGELOG && includes(tab, [THREAD.CHANGELOG, THREAD.DOC]) && (
              <IntroArrowSVG className={cn(s.arrowIcon, s.fillOrange, active && 'opacity-80')} />
            )}

            {item.key === THREAD.DOC && includes(tab, [THREAD.DOC]) && (
              <IntroSpinSVG className={cn(s.spinIcon, s.fillCyan, active && 'opacity-30')} />
            )}

            <div
              className={cn(
                s.iconBox,
                s[`${color}Border`],
                active && '-rotate-3',
                active && s[`${color}Bg`],
              )}
            >
              <PreviewBars color={color} tab={item.key} />
              <CurIcon
                className={cn(
                  s.icon,
                  s[`${color}Fill`],
                  item.key === THREAD.KANBAN && 'rotate-180 -bottom-2.5',
                  active ? '-bottom-2 -right-2 opacity-100' : '-bottom-4 -right-3 opacity-0',
                  'trans-all-200',
                )}
              />
            </div>

            <h3 className={cn(s.title, active && s.titleActive)}>{item.title}</h3>
            <div className={cn(s.desc, active && s.descActive)}>{item.desc}</div>
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
