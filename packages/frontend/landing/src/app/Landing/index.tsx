'use client'

/* *
 * LandingPage
 */

import { ROUTE } from '~/const/route'
import ArrowSVG from '~/icons/ArrowSimple'
import LinkSVG from '~/icons/LinkOutside'
import GithubSVG from '~/icons/social/Github'

import useTheme from '~/hooks/useTheme'

import Button from '~/widgets/Buttons/Button'
import BorderButton from '~/widgets/Buttons/BorderButton'
import Tooltip from '~/widgets/Tooltip'
import HomeHeader from '~/widgets/HomeHeader'

import useSalon from './salon'

export default () => {
  const s = useSalon()
  const { isLightTheme } = useTheme()

  return (
    <div className={s.wrapper} data-testid="landing-page">
      {/* <DashboardIntros /> */}
      {/* <PatternBg /> */}
      <div className={s.inner}>
        {/* <BgGlow wallpaper={wallpaper} /> */}
        <div className={s.banner}>
          <HomeHeader />
          <div className={s.githubInfo}>
            <GithubSVG className={s.githubIcon} style={s.githubIconStyle} />
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className={s.githubText}
              style={s.textGradientStyle}
            >
              Github
            </a>
          </div>
          <h1 className={s.title}>让你的产品听见用户的声音</h1>
          <div className={s.desc}>
            讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品
          </div>

          <div className={s.buttonGroup}>
            <a href={ROUTE.APPLY_COMMUNITY} className={s.linkable}>
              <BorderButton space={8} className="bold-sm">
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
              placement="bottom"
              delay={200}
              offset={[1, 5]}
            >
              <Button
                size="medium"
                ghost
                noBorder
                withSoftBg
                className={isLightTheme && 'brightness-95'}
              >
                <div className="ml-2" />
                在线体验 <ArrowSVG className={s.arrow} />
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className={s.divider} />
      </div>
    </div>
  )
}
