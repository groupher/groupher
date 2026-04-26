import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import CitySelector from '~/widgets/CitySelector'
import Input from '~/widgets/Input'

import { FIELD } from '../../constant'
import useBaseInfo from '../../logic/useBaseInfo'
import useSalon from '../../salon/basic_info/other_info'
import SavingBar from '../../SavingBar'
import MediaEditor from './MediaEditor'

const OtherInfo: FC = () => {
  const { city, techstack, isCityTouched, isMediaReportsTouched, edit } = useBaseInfo()
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.label}>{t('dsb.base_info.other.city.label')}</div>
      <CitySelector value={city} onChange={(v) => edit(v, 'city')} top={4} bottom={4} />

      <SavingBar
        field={FIELD.BASE_INFO}
        isTouched={isCityTouched}
        loading={false}
        top={30}
        left={-1}
      />

      <div className={s.divider} />
      <div className={s.label}>{t('dsb.base_info.other.tech_stack.label')}</div>
      <Input className={s.input} value={techstack} onChange={(v) => edit(v, 'techstack')} />
      <p className={s.hint}>{t('dsb.base_info.other.tech_stack.hint')}</p>

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
