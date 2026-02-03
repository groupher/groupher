import type { FC } from 'react'

import CitySelector from '~/widgets/CitySelector'
import Input from '~/widgets/Input'

import { FIELD } from '../../constant'
import useBaseInfo from '../../logic/useBaseInfo'
import SavingBar from '../../SavingBar'
import useSalon from '../../salon/basic_info/other_info'

import MediaEditor from './MediaEditor'

const OtherInfo: FC = () => {
  const { city, techstack, isCityTouched, isMediaReportsTouched, edit } = useBaseInfo()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.label}>团队所在城市</div>
      <CitySelector value={city} onChange={(v) => edit(v, 'city')} top={4} bottom={4} />

      <SavingBar
        field={FIELD.BASE_INFO}
        isTouched={isCityTouched}
        loading={false}
        top={30}
        left={-1}
      />

      <div className={s.divider} />
      <div className={s.label}>技术栈</div>
      <Input className={s.input} value={techstack} onChange={(v) => edit(v, 'techstack')} />
      <p className={s.hint}>团队主要的开发/创作工具等，多项请用 , 隔开。</p>

      <div className='mt-5' />

      <div className={s.divider} />

      <MediaEditor />

      <SavingBar
        field={FIELD.MEDIA_REPORTS}
        isTouched={isMediaReportsTouched}
        loading={false}
        top={14}
        left={-1}
      />
    </div>
  )
}

export default OtherInfo
