import useTrans from '~/hooks/useTrans'
import GtdWipSVG from '~/icons/GtdWip'
import TagSVG from '~/icons/HashTagBold'
import useSalon, { cn } from '../../salon/compare_dev/bg_shapes'
import CurveLine1SVG from '../../salon/compare_dev/bg_shapes/CurveLine1'
import CurveLine2SVG from '../../salon/compare_dev/bg_shapes/CurveLine2'
import CurveLine3SVG from '../../salon/compare_dev/bg_shapes/CurveLine3'
import CurveLine4SVG from '../../salon/compare_dev/bg_shapes/CurveLine4'
import ShapeCircleSVG from '../../salon/compare_dev/bg_shapes/ShapeCircle'
import ShapeCircleHalfSVG from '../../salon/compare_dev/bg_shapes/ShapeCircleHalf'
import ShapeCross2SVG from '../../salon/compare_dev/bg_shapes/ShapeCross2'
import TwoLineSVG from '../../salon/compare_dev/bg_shapes/TwoLine'

export default function BgShapes() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.wipItem}>
        <GtdWipSVG className={cn(s.wipIcon, 'animate-spin')} />
        <div className={s.wipText}>{t('landing.compare.shape.wip')}</div>

        <TwoLineSVG className={s.waweLine} />
      </div>

      <div className={s.topicItem}>
        <TagSVG className={s.wipIcon} />
        <div className={s.wipText}>{t('landing.compare.shape.topic')}</div>
      </div>

      <div className={s.versionText}>v 1.4.2</div>
      <div className={s.thxText}>{t('landing.compare.shape.thanks')}</div>

      <CurveLine1SVG className={s.curveLineTL} />
      <CurveLine3SVG className={s.curveLineBL} />

      <CurveLine2SVG className={s.curveLineTR} />
      <CurveLine4SVG className={s.curveLineBR} />

      <ShapeCross2SVG className={cn(s.shapeIcon, s.fillGreen, 'bottom-36 right-60')} />
      <ShapeCross2SVG className={cn(s.shapeIcon, s.fillOrange, 'bottom-24 right-52 opacity-20')} />

      <ShapeCircleSVG
        className={cn(s.shapeIcon, s.fillGreen, 'size-8 top-14 left-40 opacity-20')}
      />

      <ShapeCircleHalfSVG
        className={cn(s.shapeIcon, s.fillOrange, 'size-14 top-14 right-32 -rotate-12')}
      />
      <TwoLineSVG
        className={cn(
          s.shapeIcon,
          s.fillDigest,
          'size-7 top-28 right-36 ml-2 opacity-15 rotate-12',
        )}
      />

      <div className={cn(s.squareIcon, 'bottom-48 left-28')} />
      <div className={cn(s.circleIcon, 'bottom-24 left-36')} />
    </div>
  )
}
