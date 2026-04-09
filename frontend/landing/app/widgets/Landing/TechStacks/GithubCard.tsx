import dynamic from 'next/dynamic'

import { COLOR } from '~/const/colors'
import useTrans from '~/hooks/useTrans'
import GithubSVG from '~/icons/social/Github'
import ArrowLinker from '~/widgets/ArrowLinker'
import useSalon, { cn } from '../salon/tech_stacks/github_card'
import LangBars from './LangBars'
import Teams from './Teams'

const Trend: any = dynamic(() => import('react-trend'), { ssr: false })

export default function GithubCard() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <GithubSVG className={s.githubIcon} />

      <div className={s.topping}>
        <div className={s.githubTitle} style={s.gradientTextStyle}>
          {t('landing.tech.github.title')}
        </div>
        <div className={s.desc}>{t('landing.tech.github.desc')}</div>
      </div>

      <div className={s.numIntro}>
        <div className={s.num}>204</div>
        <div className={s.unit}>stars</div>

        <div className={s.numDivider} />
        <div className={s.num}>21</div>
        <div className={s.unit}>open issues</div>
      </div>

      <div className={s.row}>
        <div className={s.label}>{t('landing.tech.github.latest_version')}</div>
        <div className={s.text}>v2.0.1</div>
      </div>

      <div className={cn(s.row, 'items-center mb-3 mt-5')}>
        <div className={s.label}>{t('landing.tech.github.activity')}</div>
        <div className={s.trend}>
          <Trend
            smooth
            width={100}
            height={50}
            data={[2, 3, 6, 0, 2, 10, 8, 8, 22, 33, 2, 3, 4, 5, 6]}
            gradient={['#E3B18B', '#C48BC2']}
            radius={15}
            strokeWidth={1}
            strokeLinecap='round'
          />
        </div>
      </div>

      <div className={s.row}>
        <div className={s.label}>{t('landing.tech.github.license')}</div>
        <div className={s.text}>AGPL-3.0, self-host free</div>
      </div>

      <div className={s.row}>
        <div className={s.label}>{t('landing.tech.github.language')}</div>
        <LangBars />
      </div>

      <Teams />

      <div className={s.footer}>
        <ArrowLinker href='/' color={COLOR.PURPLE} className='pl-0.5'>
          {t('landing.tech.github.home')}
        </ArrowLinker>
      </div>
    </div>
  )
}
