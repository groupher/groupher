/*
 *
 * Content
 *
 */

import useAccount from '~/stores/account/hooks'
import { STEP } from '../constant'
import useLogic from '../useLogic'
import SetupDomain from './SetupDomain'
import SetupInfo from './SetupInfo'

export default function Content() {
  const { isLogin } = useAccount()
  const { step, validState } = useLogic()

  if (step === STEP.FINISHED) return null

  if (!validState.hasPendingApply && !isLogin) {
    return null
  }

  if (isLogin && validState.hasPendingApply) {
    return null
  }

  let stepComp = null

  switch (step) {
    case STEP.SELECT_TYPE: {
      stepComp = null
      break
    }
    case STEP.SETUP_DOMAIN: {
      stepComp = <SetupDomain />
      break
    }
    case STEP.SETUP_EXTRA: {
      stepComp = null
      break
    }
    default: {
      stepComp = <SetupInfo />
      break
    }
  }

  return <div className='justify-center row'>{stepComp}</div>
}
