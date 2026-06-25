'use client'

/* *
 * LandingPage
 */

import { DOC_FAQ_LAYOUT } from '~/const/layout'
import { ROUTE } from '~/const/route'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import BookSVG from '~/icons/Book'
import DiscussSVG from '~/icons/DiscussSolid'
import KanbanSVG from '~/icons/Kanban'
import LinkSVG from '~/icons/LinkOutside'
import { mockUsers } from '~/mock'
import FaqList from '~/unit/FaqList'
import BorderButton from '~/widgets/Buttons/BorderButton'
import Button from '~/widgets/Buttons/Button'
import Facepile from '~/widgets/Facepile'
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

export default function Landing() {
  const s = useSalon()
  const { isLightTheme } = useTheme()
  const { t } = useTrans()
  const users = mockUsers(6)
  const faqKeys = [
    ['landing.faq.0.title', 'landing.faq.0.body'],
    ['landing.faq.1.title', 'landing.faq.1.body'],
    ['landing.faq.2.title', 'landing.faq.2.body'],
    ['landing.faq.3.title', 'landing.faq.3.body'],
    ['landing.faq.4.title', 'landing.faq.4.body'],
    ['landing.faq.5.title', 'landing.faq.5.body'],
  ] as const
  const faqs = faqKeys.map(([titleKey, bodyKey], index) => ({
    id: `${titleKey}:${bodyKey}`,
    title: t(titleKey),
    body: t(bodyKey),
    index,
  }))

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
            <span className='mr-1 inline-block -rotate-12 text-3xl'>📝</span>
            <BookSVG className={cn(s.icon, s.cyanFill, 'rotate-12')} />
            <div className={s.iconFootBar} />
          </div>

          <h1 className={s.title}>{t('landing.hero.title')}</h1>
          <div className={s.desc}>
            {t('landing.hero.desc.prefix')}
            <div className='ml-3 inline-block'>
              <Facepile users={users} noLazyLoad showMore={false} />
            </div>
            {t('landing.hero.desc.feedback')}
          </div>
          <div className={cn(s.desc, 'mt-2')}>
            {t('landing.hero.subline.prefix')}
            <span className='px-0.5 line-through'>{t('landing.hero.subline.team')}</span>
            <span className={s.focus}>{t('landing.hero.subline.user')}</span>
            {t('landing.hero.subline.suffix')}
          </div>

          <div className={s.buttonGroup}>
            <a href={ROUTE.APPLY_COMMUNITY} className={s.linkable}>
              <BorderButton space={8} className='bold-sm'>
                {t('landing.hero.cta.start')}
              </BorderButton>
            </a>

            <Tooltip
              content={
                <div className={s.demoPanel}>
                  <a href={`/${ROUTE.HOME}`} className={s.demoItem}>
                    <div className={s.demoItemTitle}>{t('landing.hero.demo.official')}</div>
                    <LinkSVG className={s.outLink} />
                  </a>
                  <a href={`/${ROUTE.HOME}/${ROUTE.DASHBOARD.OVERVIEW}`} className={s.demoItem}>
                    <div className={s.demoItemTitle}>{t('landing.hero.demo.dashboard')}</div>

                    <LinkSVG className={s.outLink} />
                  </a>
                </div>
              }
              placement='bottom'
              delay={200}
              offset={[1, 5]}
            >
              <Button size='medium' ghost noBorder soft className={isLightTheme && 'brightness-95'}>
                <div className='ml-2' />
                {t('landing.hero.cta.demo')} <ArrowSVG className={s.arrow} />
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
