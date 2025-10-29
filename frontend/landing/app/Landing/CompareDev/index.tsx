import CheckSVG from '~/icons/CheckBold'
import CloseCrossSVG from '~/icons/CloseCross'
import useSalon, { cn } from '../salon/compare_dev'
import HighWay from './HighWay'
import OurWay from './OurWay'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.slogan}>
        <div className={s.tips}>It's should be Simple !</div>
        <h3 className={s.title}>上线、获取反馈、迭代</h3>
        <div className={s.desc}>将用户反馈融入开发流程，避免平行世界闭门造车</div>
      </div>
      <div className={s.ourWall}>
        <div className={s.ourWallBg} />

        <div className={s.ourlabel}>
          <CheckSVG className={cn(s.checkIcon, s.fillGreen)} />
          与用户共赢
        </div>

        <OurWay />
      </div>
      <div className={s.theirWall}>
        <div className={s.theirWallBg} />
        <div className={s.theirlabel}>
          <CloseCrossSVG className={cn(s.checkIcon, s.fillRed)} />
          团队两行泪
        </div>
        <HighWay />
      </div>
    </div>
  )
}
