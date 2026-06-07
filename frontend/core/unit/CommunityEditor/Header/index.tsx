import AccountUnit from '~/widgets/AccountUnit'
import HomeLogo from '~/widgets/HomeLogo'
import ThemeSwitch from '~/widgets/ThemeSwitch'

import useSalon from './salon'
import useLogic from '../useLogic'
import StepMap from './StepMap'

export default function Header() {
  const s = useSalon()

  const { headerStatus } = useLogic()
  const { showStep } = headerStatus

  return (
    <div className={s.wrapper}>
      <HomeLogo size={5} right={2} />
      <h3 className={s.title}>Groupher</h3>
      <div className={s.divider} />
      <div className={s.subTitle}>创建社区</div>
      <div className='grow' />
      {showStep && <StepMap />}
      <div className='grow' />

      <div className={s.right}>
        <ThemeSwitch />
        <AccountUnit />
      </div>
    </div>
  )
}
