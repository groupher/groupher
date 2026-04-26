import useTrans from '~/hooks/useTrans'
import OSSUploader from '~/widgets/OSSUploader'

import { FIELD } from '../constant'
import useBaseInfo from '../logic/useBaseInfo'
import useSalon from '../salon/basic_info/logos'
import SavingBar from '../SavingBar'

export default function Logos() {
  const s = useSalon()
  const { t } = useTrans()
  const { edit, logo, isLogosTouched } = useBaseInfo()

  return (
    <div className={s.wrapper}>
      <h3 className={s.title}>{t('dsb.base_info.logo.favicon.title')}</h3>
      <div className={s.faviconBox}>
        <OSSUploader>
          <div className={s.favicon} />
        </OSSUploader>
      </div>
      <div className={s.desc}>{t('dsb.base_info.logo.favicon.desc')}</div>
      <div className='mb-8' />
      <h3 className={s.title}>{t('dsb.base_info.logo.title')}</h3>
      <div className={s.logoBox}>
        <OSSUploader
          previewUrl={logo}
          onDelete={() => edit('', 'logo')}
          onUploadDone={(v) => edit(v, 'logo')}
        >
          <div className={s.logo} />
        </OSSUploader>
      </div>
      <div className={s.desc}>{t('dsb.base_info.logo.desc')}</div>

      <SavingBar field={FIELD.BASE_INFO} isTouched={isLogosTouched} top={10} />
    </div>
  )
}
