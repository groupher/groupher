import { useEffect } from 'react'

import TadaSVG from '~/icons/Tada'
import { STEP } from '../constant'
import { tada } from '../helper'
import { Icon } from '../salon/banner/select_type/type_boxes'
import useSalon from '../salon/header/step_map'
import useLogic from '../useLogic'
import StatusBall from './StatusBall'

export default function StepMap() {
  const s = useSalon()

  const { headerStatus } = useLogic()
  const { step, communityType } = headerStatus

  useEffect(() => {
    if (step === STEP.FINISHED) {
      tada()
    }
  }, [step])

  const TypeIcon = Icon[communityType]

  switch (step) {
    case STEP.SELECT_TYPE: {
      return (
        <div className={s.wrapper}>
          <StatusBall doing />
          <div className={s.line} />
          <StatusBall />
          <div className={s.line} />
          <StatusBall />
          <div className={s.line} />
          <StatusBall />
        </div>
      )
    }

    case STEP.SETUP_DOMAIN: {
      return (
        <div className={s.wrapper}>
          <TypeIcon className={s.icon} />
          <div className={s.line} />
          <StatusBall doing />
          <div className={s.line} />
          <StatusBall />
          <div className={s.line} />
          <StatusBall />
        </div>
      )
    }

    case STEP.SETUP_INFO: {
      return (
        <div className={s.wrapper}>
          <TypeIcon className={s.icon} />
          <div className={s.line} />
          <StatusBall done />
          <div className={s.line} />
          <StatusBall doing />
          <div className={s.line} />
          <StatusBall />
        </div>
      )
    }

    case STEP.SETUP_EXTRA: {
      return (
        <div className={s.wrapper}>
          <TypeIcon className={s.icon} />
          <div className={s.line} />
          <StatusBall done />
          <div className={s.line} />
          <StatusBall done />
          <div className={s.line} />
          <StatusBall doing />
        </div>
      )
    }

    case STEP.FINISHED: {
      return (
        <div className={s.wrapper}>
          <TypeIcon className={s.icon} />
          <div className={s.line} />
          <StatusBall done />
          <div className={s.line} />
          <StatusBall done />
          <div className={s.line} />
          <StatusBall done />
          <div className={s.line} />
          <TadaSVG className={s.tadaIcon} onClick={() => tada()} />
        </div>
      )
    }

    default: {
      return null
    }
  }
}
