/*
 *
 * CommunitiesBanner
 *
 */

import useAccount from '~/stores/account/hooks'
import ArrowLinker from '~/widgets/ArrowLinker'
import Checker from '~/widgets/Checker'

import useLogic from '../../useLogic'
import NextStepButton from '../NextStepButton'
import useSalon from '../salon/select_type'
import TypeBoxes from './TypeBoxes'
import WarnBox from './WarnBox'

export default function SelectType() {
  const { isLogin } = useAccount()
  const { communityType, validState, nextStep, isOfficialOnChange } = useLogic()

  const selected = !!communityType

  const s = useSalon({ selected: !!communityType })

  if (!validState.hasPendingApply && !isLogin) {
    return <WarnBox title='未登录' desc='创建社区需要先登录，谢谢~' />
  }

  if (isLogin && validState.hasPendingApply) {
    return (
      <WarnBox
        title='申请处理中'
        desc='你上次申请的创建请求还在处理中，请等待处理后再次创建，谢谢~'
      />
    )
  }

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.introTitle}>选择社区类型</div>
        {!selected ? (
          <div className={s.introDesc}>
            请根据你服务的类型选择分类
            <br />
            后续你的社区会展示在发现页，进一步提升曝光度。
          </div>
        ) : (
          <div className={s.divider} />
        )}

        <TypeBoxes />

        {!selected && <div className='mb-48' />}
        {selected && (
          <div className={s.note}>
            <Checker
              checked={validState.isOfficialValid}
              size='small'
              onChange={isOfficialOnChange}
            />
            我代表产品官方团队，
            <ArrowLinker href='/' className='py-0.5'>
              为什么
            </ArrowLinker>
          </div>
        )}

        {selected && (
          <div className={s.nextBtn}>
            <NextStepButton
              onClick={nextStep}
              disabled={!(validState.isCommunityTypeValid && validState.isOfficialValid)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
