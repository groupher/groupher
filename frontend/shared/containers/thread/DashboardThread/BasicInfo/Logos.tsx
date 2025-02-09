import OSSUploader from '~/widgets/OSSUploader'

import { SETTING_FIELD } from '../constant'
import SavingBar from '../SavingBar'

import useBaseInfo from '../logic/useBaseInfo'
import useSalon from '../salon/basic_info/logos'

export default () => {
  const s = useSalon()
  const { edit, saving, logo, isLogosTouched } = useBaseInfo()

  return (
    <div className={s.wrapper}>
      <h3 className={s.title}>favicon</h3>
      <div className={s.faviconBox}>
        <OSSUploader>
          <div className={s.favicon} />
        </OSSUploader>
      </div>
      <div className={s.desc}>上传 favicon, 仅支持 ico 格式，最大 10 KB。可选。</div>
      <div className="mb-8" />
      <h3 className={s.title}>LOGO</h3>
      <div className={s.logoBox}>
        <OSSUploader
          previewUrl={logo}
          onDelete={() => edit('', 'logo')}
          onUploadDone={(v) => edit(v, 'logo')}
        >
          <div className={s.logo} />
        </OSSUploader>
      </div>
      <div className={s.desc}>上传社区 Logo, 支持常见图片格式，200 KB以内。可选。</div>

      <SavingBar
        field={SETTING_FIELD.BASE_INFO}
        isTouched={isLogosTouched}
        loading={saving}
        top={10}
      />
    </div>
  )
}
