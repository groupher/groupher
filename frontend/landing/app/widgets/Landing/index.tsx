'use client'

/* *
 * LandingPage
 */

import { DOC_FAQ_LAYOUT } from '~/const/layout'

import { ROUTE } from '~/const/route'
import useTheme from '~/hooks/useTheme'
import ArrowSVG from '~/icons/ArrowSimple'
import BookSVG from '~/icons/Book'
import DiscussSVG from '~/icons/DiscussSolid'
import KanbanSVG from '~/icons/Kanban'
import LinkSVG from '~/icons/LinkOutside'
import { mockUsers } from '~/mock'
import BorderButton from '~/widgets/Buttons/BorderButton'
import Button from '~/widgets/Buttons/Button'
import Facepile from '~/widgets/Facepile'
import FaqList from '~/widgets/FaqList'
import Tooltip from '~/widgets/Tooltip'

import ArticlesIntroTabs from './ArticlesIntroTabs'
import BatteryBento from './BatteryBento'
import CompareDev from './CompareDev'
import CoverImage from './CoverImage'
import DashboardIntros from './DashboardIntros'
import Footer from './Footer'
import JoinOurCommunity from './JoinOurCommunity'
import useSalon, { cn } from './salon'
import TechStacks from './TechStacks'
import UsersWall from './UsersWall'

// TODO: move to const later
const faqs = [
  {
    title: 'Groupher 是免费的吗',
    body: '是的，在一定额度内免费使用，部分高级功能需要收费。',
    index: 0,
  },
  {
    title: '可以只使用某些模块吗',
    body: '是的，你可以根据需要单独使用讨论区、看板、更新日志等。',
    index: 1,
  },
  {
    title: '可以私有部署吗',
    body: '是的，本项目完全开源，你可以用于私有部署，但需要遵守特定协议。',
    index: 2,
  },
  {
    title: '支持手机端使用吗',
    body: '是的，本项目对于手机屏幕做了适配。但目前没有原生的 App',
    index: 3,
  },
  {
    title: '支持内容审核吗',
    body: '是的，你可以在后台打开先审后发，同时平台 AI 自动会过滤违法信息。',
    index: 4,
  },
  {
    title: '支持海外访问吗',
    body: '是的，但是目前服务器在国内，国际化相关工作还在开发中，敬请期待。',
    index: 5,
  },
]

export default () => {
  const s = useSalon()
  const { isLightTheme } = useTheme()
  const users = mockUsers(6)

  return (
    <div className={s.wrapper} data-testid='landing-page'>
      {/* <DashboardIntros /> */}
      {/* <PatternBg /> */}
      <div className={s.inner}>
        {/* <BgGlow wallpaper={wallpaper} /> */}
        <div className={s.banner}>
          {/* <div className={s.githubInfo}>
            <GithubSVG className={s.githubIcon} style={s.githubIconStyle} />
            <a
              href='https://github.com/groupher/groupher'
              target='_blank'
              rel='noreferrer'
              className={s.githubText}
              style={s.textGradientStyle}
            >
              Github
            </a>
          </div> */}
          <div className={s.iconHead}>
            <DiscussSVG className={cn(s.icon, s.purpleFill, '-rotate-6')} />
            <div className='inline-block -rotate-12'>
              <KanbanSVG className={cn(s.icon, s.blueFill, 'rotate-180')} />
            </div>
            <span className='inline-block mr-1 text-3xl -rotate-12'>📝</span>
            <BookSVG className={cn(s.icon, s.cyanFill, 'rotate-12')} />
            <div className={s.iconFootBar} />
          </div>

          <h1 className={s.title}>让你的产品听见用户的声音</h1>
          <div className={s.desc}>
            讨论区、看板、更新日志、文档多合一，收集沉淀
            <div className='inline-block ml-3'>
              <Facepile users={users} noLazyLoad showMore={false} />
            </div>
            反馈
          </div>
          <div className={cn(s.desc, 'mt-2')}>
            与<span className='line-through px-0.5'>团队</span>
            <span className={s.focus}>用户</span>
            一起打造更好的产品
          </div>

          <div className={s.buttonGroup}>
            <a href={ROUTE.APPLY_COMMUNITY} className={s.linkable}>
              <BorderButton space={8} className='bold-sm'>
                开始使用
              </BorderButton>
            </a>

            <Tooltip
              content={
                <div className={s.demoPanel}>
                  <a href={`/${ROUTE.HOME}`} className={s.demoItem}>
                    <div className={s.demoItemTitle}>官方社区</div>
                    <LinkSVG className={s.outLink} />
                  </a>
                  <a href={`/${ROUTE.HOME}/${ROUTE.DASHBOARD.OVERVIEW}`} className={s.demoItem}>
                    <div className={s.demoItemTitle}>管理后台</div>

                    <LinkSVG className={s.outLink} />
                  </a>
                </div>
              }
              placement='bottom'
              delay={200}
              offset={[1, 5]}
            >
              <Button
                size='medium'
                ghost
                noBorder
                withSoftBg
                className={isLightTheme && 'brightness-95'}
              >
                <div className='ml-2' />
                在线体验 <ArrowSVG className={s.arrow} />
              </Button>
            </Tooltip>
          </div>
        </div>

        <CoverImage />

        <ArticlesIntroTabs />

        <BatteryBento />

        <DashboardIntros />

        <TechStacks />

        <CompareDev />

        <UsersWall />

        <section className={s.faqWrapper}>
          <FaqList layout={DOC_FAQ_LAYOUT.LEFT_RIGHT} sections={faqs} />
        </section>

        <JoinOurCommunity />

        <Footer />
      </div>
    </div>
  )
}
