import type { FC } from 'react'

import useSalon from '../../salon/domain'

const Domain: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div>自定义域名</div>
    </div>
  )
}

export default Domain
