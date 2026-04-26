import ApplySVG from '~/icons/Apply'
import UploadSVG from '~/icons/Upload'
import Img from '~/Img'
import { nilOrEmpty } from '~/validator'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import Input from '~/widgets/Input'
import OSSUploader from '~/widgets/OSSUploader'

import useSalon from '../salon/banner/setup_info'
import useLogic from '../useLogic'
import NextStepButton from './NextStepButton'

export default function SetupInfo() {
  const s = useSalon()

  const { title, desc, logo, validState, pervStep, nextStep, inputOnChange } = useLogic()

  const { isTitleValid, isDescValid, isLogoValid } = validState
  const isValid = isTitleValid && isDescValid && isLogoValid

  return (
    <div className={s.wrapper}>
      <div className={s.head}>
        <ApplySVG className={s.applyIcon} />
        <div className={s.introTitle}>基本信息</div>
      </div>
      <div className={s.info}>
        <OSSUploader onUploadDone={(url) => inputOnChange(url, 'logo')}>
          {nilOrEmpty(logo) ? (
            <div className={s.holderWrapper}>
              <UploadSVG className={s.uploadIcon} />
              <div className={s.uploadText}>LOGO</div>
            </div>
          ) : (
            <Img src={logo} className={s.realCover} />
          )}
        </OSSUploader>
        <div className={s.inputs}>
          <Input
            className={s.input}
            value={title}
            placeholder='社区名称'
            onChange={(e) => inputOnChange(e, 'title')}
            autoFocus
          />
          <div className='mb-2.5' />
          <Input
            className={s.input}
            value={desc}
            placeholder='社区一句话描述'
            onChange={(e) => inputOnChange(e, 'desc')}
          />
        </div>
      </div>

      <div className={s.nextBtns}>
        <ArrowButton leftLayout onClick={pervStep} dimWhenIdle className={s.prevBtn}>
          上一步
        </ArrowButton>
        <div className='mr-6' />
        <NextStepButton onClick={nextStep} disabled={!isValid} />
      </div>
    </div>
  )
}
