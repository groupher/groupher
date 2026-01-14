import THEME from '~/const/theme'
import useSalon from '../salon/tech_stacks'
import GithubCard from './GithubCard'
import Keyboard from './Keyboard'

export default function TechStacks() {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <div className={s.slogan}>
        <h3 className={s.title}>Open Web, Open Source</h3>
        <div className={s.desc}>由久经考验的优秀开源技术栈驱动，期待您的共同参与</div>
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
