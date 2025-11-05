import useSalon, { cn } from '../salon/tech_stacks'

import GithubCard from './GithubCard'
import StackCard from './StackCard'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.slogan}>
        <h3 className={s.title}>Open Web, Open Source</h3>
        <div className={s.desc}>由久经考验的优秀开源技术栈驱动，期待您的共同参与</div>
      </div>
      <div className={s.wall} data-theme='dark'>
        <div className={s.inner}>
          <div className={s.innerBgWrapper}>
            <img
              src='/cad-bg.png'
              className={cn(s.cadBg, 'left-0 w-8/12', s.cadDark)}
              alt='card-bg'
            />
            <img
              src='/cad-bg.png'
              className={cn(s.cadBg, 'right-0 w-4/12 rotate-180', s.cadDark)}
              alt='card-bg'
            />
          </div>
          <StackCard />
          <GithubCard />
        </div>
      </div>
    </div>
  )
}
