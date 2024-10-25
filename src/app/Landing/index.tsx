'use client'

/* *
 * LandingPage
 */

import Link from 'next/link'

import { DOC_FAQ_LAYOUT } from '~/const/layout'
import useWallpaper from '~/hooks/useWallpaper'

import { ROUTE } from '~/const/route'

import ArrowSVG from '~/icons/ArrowSimple'
import LinkSVG from '~/icons/LinkOutside'

import Button from '~/widgets/Buttons/Button'
import BorderButton from '~/widgets/Buttons/BorderButton'
import Tooltip from '~/widgets/Tooltip'
import FaqList from '~/widgets/FaqList'
import HomeHeader from '~/widgets/HomeHeader'

import CoverImage from './CoverImage'

import ArticlesIntroTabs from './ArticlesIntroTabs'
import BatteryBento from './BatteryBento'
import TechStacks from './TechStacks'
import DashboardIntros from './DashboardIntros'
import CompareDev from './CompareDev'
import UsersWall from './UsersWall'
import Footer from './Footer'

import useSalon, { cn } from './styles'

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

  const { wallpaper } = useWallpaper()

  return (
    <div className={s.wrapper} data-testid="landing-page">
      <DashboardIntros />
      {/* <PatternBg /> */}
      <div className={s.inner}>
        {/* <BgGlow wallpaper={wallpaper} /> */}
        <div className={s.banner}>
          <HomeHeader />
          <div className={s.betaText} style={{ background: s.betaGradientStyle }}>
            内测中
          </div>
          <h1 className={s.title}>让你的产品听见用户的声音</h1>
          <div className={s.desc}>
            讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品
          </div>

          <div className={s.buttonGroup}>
            <Link href={ROUTE.APPLY_COMMUNITY} className={s.linkable}>
              <BorderButton space={8}>开始使用</BorderButton>
            </Link>

            <Tooltip
              content={
                <div className={s.demoPanel}>
                  <Link href={`/${ROUTE.HOME}`} className={s.demoItem}>
                    <div className={s.demoItemTitle}>官方社区</div>
                    <LinkSVG className={s.outLink} />
                  </Link>
                  <Link href={`/${ROUTE.HOME}/${ROUTE.DASHBOARD.OVERVIEW}`} className={s.demoItem}>
                    <div className={s.demoItemTitle}>管理后台</div>

                    <LinkSVG className={s.outLink} />
                  </Link>
                </div>
              }
              placement="bottom"
              delay={200}
              offset={[1, 5]}
            >
              <Button size="medium" ghost>
                在线体验 <ArrowSVG className={s.arrow} />
              </Button>
            </Tooltip>
          </div>
        </div>

        <CoverImage />

        <ArticlesIntroTabs />

        <BatteryBento />

        {/* <DashboardIntros /> */}

        <TechStacks />

        <CompareDev />

        <div className={cn(s.divider, 'mt-20')} />
        <UsersWall wallpaper={wallpaper} />
        <div className={s.divider} />

        <div className={s.faqWrapper}>
          <FaqList layout={DOC_FAQ_LAYOUT.FLAT} large sections={faqs} />
        </div>

        <div className={s.divider} />

        <Footer />
      </div>
    </div>
  )
}
