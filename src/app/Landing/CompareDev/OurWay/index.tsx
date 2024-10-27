import { COLOR_NAME } from '~/const/colors'

import NodeBlock from './NodeBlock'
import BgShapes from './BgShapes'
import Fans from './Fans'

import SeedSVG from '~/icons/Seed'
import TadaSVG from '~/icons/Tada'

import useSalon from '../../salon/compare_dev/our_way'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <BgShapes />
      <Fans />
      <SeedSVG className={s.seedIcon} />

      <div className={s.connectLine} />

      <div className={s.nodes}>
        <NodeBlock index={0} cat="DEFAULT" rightDot="bottom-10 mt-0.5" leftDot="bottom-10" />
        <NodeBlock
          cat="FEATURE"
          className="absolute mt-2 top-16 left-56"
          rightDot="bottom-8"
          bg={COLOR_NAME.PURPLE}
        />
        <NodeBlock
          cat="OTHER"
          className="absolute bottom-20 left-56"
          rightDot="top-10 mt-1"
          bg={COLOR_NAME.BLUE}
        />
        <NodeBlock index={1} cat="DEFAULT" rightDot="bottom-10 mt-0.5" leftDot="bottom-10" />
        <NodeBlock
          cat="BUG"
          className="absolute mt-2 mr-12 top-16 right-80"
          rightDot="bottom-7"
          bg={COLOR_NAME.ORANGE}
        />
        <NodeBlock
          cat="QUESTION"
          className="absolute ml-20 bottom-14 right-96"
          rightDot="top-6"
          bg={COLOR_NAME.GREEN}
        />
        <NodeBlock index={2} cat="DEFAULT" rightDot="bottom-10 mt-px" />
      </div>

      <div className="row-center">
        <TadaSVG className={s.tadaIcon} />
      </div>
    </div>
  )
}
