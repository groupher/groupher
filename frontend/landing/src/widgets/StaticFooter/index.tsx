import { DOCS, FEEDBACK, ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import GithubSVG from '~/icons/social/Github'
import Img from '~/Img'

import useSalon from '../salon/static_footer'

const GROUPS = [
  {
    title: 'landing.static_footer.product',
    links: [
      { title: 'landing.static_footer.pricing', href: `/${ROUTE.PRICE}` },
      { title: 'landing.static_footer.book_demo', href: `/${ROUTE.BOOK_DEMO}` },
      { title: 'landing.static_footer.create', href: ROUTE.APPLY },
    ],
  },
  {
    title: 'landing.static_footer.community',
    links: [
      { title: 'landing.static_footer.forum', href: `/${ROUTE.HOME}` },
      { title: 'landing.static_footer.docs', href: DOCS },
      { title: 'landing.static_footer.feedback', href: FEEDBACK },
    ],
  },
] as const

export default function StaticFooter() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <footer className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.main}>
          <div className={s.brand}>
            <a href='/' className={s.brandLink}>
              <Img src='/groupher.png' className={s.logo} noLazy />
              <span>Groupher</span>
            </a>
            <p className={s.tagline}>{t('landing.hero.title')}</p>
            <a
              href='https://github.com/groupher/groupher'
              target='_blank'
              rel='noopener noreferrer'
              aria-label='Groupher on GitHub'
              className={s.socialLink}
            >
              <GithubSVG className={s.socialIcon} />
            </a>
          </div>

          {GROUPS.map((group) => (
            <div className={s.column} key={group.title}>
              <h3 className={s.columnTitle}>{t(group.title)}</h3>
              <div className={s.links}>
                {group.links.map((link) => (
                  <a className={s.link} href={link.href} key={link.title}>
                    {t(link.title)}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={s.bottom}>
          <span>Made in ChengDu</span>
          <span>{t('landing.static_footer.report')}</span>
        </div>
      </div>
    </footer>
  )
}
