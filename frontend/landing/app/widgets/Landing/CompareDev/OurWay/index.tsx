import { COLOR } from '~/const/colors'
import { ARTICLE_CAT } from '~/const/gtd'
import SeedSVG from '~/icons/Seed'
import TadaSVG from '~/icons/Tada'
import useSalon from '../../salon/compare_dev/our_way'
import BgShapes from './BgShapes'
import Fans from './Fans'
import NodeBlock from './NodeBlock'

export default function OurWay() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.connectLine} />

      <SeedSVG className={s.seedIcon} />

      <div className={s.nodes}>
        <NodeBlock index={0} cat='DEFAULT' rightDot='bottom-10 mt-0.5' leftDot='bottom-10' />
        <NodeBlock
          cat={ARTICLE_CAT.FEATURE}
          className='absolute mt-2 top-16 left-56 rotate-3'
          rightDot='bottom-8 mb-1'
          bg={COLOR.PURPLE}
        />
        <NodeBlock
          cat={ARTICLE_CAT.OTHER}
          className='absolute bottom-20 left-56 -rotate-6'
          rightDot='top-12 mt-1'
          bg={COLOR.BLUE}
        />
        <NodeBlock index={1} cat='DEFAULT' rightDot='bottom-10 mt-0.5' leftDot='bottom-10' />
        <NodeBlock
          cat={ARTICLE_CAT.BUG}
          className='absolute z-10 mt-2 mr-12 top-16 right-80 -rotate-6'
          rightDot='bottom-5'
          bg={COLOR.ORANGE}
        />
        <NodeBlock
          cat={ARTICLE_CAT.QUESTION}
          className='absolute ml-20 bottom-14 right-96 rotate-3'
          rightDot='top-5'
          bg={COLOR.GREEN}
        />
        <NodeBlock index={2} cat='DEFAULT' rightDot='bottom-10 mt-px' />
      </div>

      <div className='row-center'>
        <TadaSVG className={s.tadaIcon} />
      </div>

      <BgShapes />
      <Fans />
    </div>
  )
}
