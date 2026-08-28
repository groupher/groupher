import THEME from '~/const/theme'
import useTrans from '~/hooks/useTrans'

import useSalon from '../salon/tech_stacks'
import GithubCard from './GithubCard'
import Keyboard from './Keyboard'

export default function TechStacks() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <section className={s.wrapper}>
      <div className={s.slogan}>
        <h3 className={s.title}>{t('landing.tech.title')}</h3>
        <div className={s.desc}>{t('landing.tech.desc')}</div>
      </div>
      <div className={s.wall} data-theme={THEME.DARK}>
        <div
          className={s.mask}
          style={{
            background:
              'radial-gradient(circle at center, transparent 50%, transparent 55%, black 10%)',
          }}
        />
        <div className={s.inner}>
          <Keyboard />
          <GithubCard />
        </div>
      </div>
    </section>
  )
}
