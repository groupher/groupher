/*
 *
 * CommunitiesBanner
 *
 */

import useAccount from '~/hooks/useAccount'
import ArrowLinker from '~/widgets/ArrowLinker'
import Checker from '~/widgets/Checker'

import NextStepButton from '../NextStepButton'
import TypeBoxes from './TypeBoxes'
import WarnBox from './WarnBox'

import useLogic from '../../useLogic'
import useSalon from '../../styles/banner/select_type'

export default () => {
  const { isLogin } = useAccount()
  const { communityType, validState, nextStep, isOfficalOnChange } = useLogic()

  const s = useSalon({ selected: !!communityType })

  if (!validState.hasPendingApply && !isLogin) {
    return <WarnBox title="未登录" desc="创建社区需要先登录，谢谢~" />
  }

  if (isLogin && validState.hasPendingApply) {
    return (
      <WarnBox
        title="申请处理中"
        desc="你上次申请的创建请求还在处理中，请等待处理后再次创建，谢谢~"
      />
    )
  }

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.introTitle}>选择你的社区类型</div>
        <div className={s.introDesc}>请根据你服务的类型选择，后续和展示在发现页，提升曝光度。</div>

        <TypeBoxes />

        {!communityType && <div className="mb-48" />}
        {communityType && (
          <div className={s.note}>
            <Checker
              checked={validState.isOfficalValid}
              size="small"
              onChange={isOfficalOnChange}
            />
            我代表产品官方团队，
            <ArrowLinker href="/">为什么</ArrowLinker>
          </div>
        )}

        {communityType && (
          <div className={s.nextBtn}>
            <NextStepButton
              onClick={nextStep}
              disabled={!(validState.isCommunityTypeValid && validState.isOfficalValid)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
