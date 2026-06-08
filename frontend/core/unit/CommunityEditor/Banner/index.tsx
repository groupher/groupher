/*
 *
 * Banner
 *
 */

import { STEP } from '../constant'
import useLogic from '../useLogic'
import Finished from './Finished'
import useSalon from './salon'
import SelectType from './SelectType'
import SetupDomain from './SetupDomain'
import SetupExtra from './SetupExtra'
import SetupInfo from './SetupInfo'

export default function Banner() {
  const s = useSalon()

  const { step } = useLogic()

  let stepComp = null

  switch (step) {
    case STEP.SELECT_TYPE: {
      stepComp = <SelectType />
      break
    }
    case STEP.SETUP_INFO: {
      stepComp = <SetupInfo />
      break
    }

    case STEP.SETUP_EXTRA: {
      stepComp = <SetupExtra />
      break
    }
    case STEP.FINISHED: {
      stepComp = <Finished />
      break
    }
    default: {
      stepComp = <SetupDomain />
      break
    }
  }

  return <div className={s.wrapper}>{stepComp}</div>
}
