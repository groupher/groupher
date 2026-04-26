import { isEmpty } from 'ramda'

import { cutRest } from '~/fmt'
import DomainSVG from '~/icons/Domain'
import ArrowButton from '~/widgets/Buttons/ArrowButton'

import useSalon from '../salon/banner/setup_domain'
import useLogic from '../useLogic'
import InputBox from './InputBox'
import NextStepButton from './NextStepButton'

export default function SetupDomain() {
  const s = useSalon()

  const { slug, validState, pervStep, nextStep, inputOnChange } = useLogic()
  const { isRawValid, checking, communityExist } = validState

  const fmtError = !isEmpty(slug) && !communityExist && !isRawValid
  const slugExist = !checking && communityExist

  return (
    <div className={s.wrapper}>
      <h3 className={s.introTitle}>
        <DomainSVG className={s.introLogo} />
        社区域名
      </h3>

      <InputBox value={slug} placeholder='your-domain' onChange={(e) => inputOnChange(e, 'slug')} />

      {fmtError && <div className={s.errorMsg}>仅支持字母、数字与-_的组合</div>}

      {slugExist && (
        <div className={s.errorMsg}>
          {cutRest(slug, 8)} 已存在（或他人在申请中），请尝试其他域名
        </div>
      )}

      {!(fmtError || slugExist) && (
        <div className={s.nextBtn}>
          <ArrowButton leftLayout onClick={pervStep} dimWhenIdle className={s.prevBtn}>
            上一步
          </ArrowButton>

          <NextStepButton loading={checking} onClick={nextStep} disabled={!isRawValid} />
        </div>
      )}
    </div>
  )
}
