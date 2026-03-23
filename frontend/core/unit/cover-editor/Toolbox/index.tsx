import type { FC } from 'react'
import useSalon from '../salon/toolbox'
import useLogic from '../useLogic'
import ActionBlock from './ActionBlock'
import BackgroundBlock from './BackgroundBlock'
import BorderBlock from './BorderBlock'
import LightBlock from './LightBlock'
import PositionBlock from './PositionBlock'
import RatioBlock from './RatioBlock'
import RotateBlock from './RotateBlock'
import ShadowBlock from './ShadowBlock'
import SizeBlock from './SizeBlock'

type TProps = {
  onDelete: () => void
  onReplace: () => void
}

const Toolbox: FC<TProps> = ({ onDelete, onReplace }) => {
  const s = useSalon()
  const { toolboxSetting: setting } = useLogic()

  return (
    <div className={s.wrapper}>
      <PositionBlock pos={setting.pos} />
      <SizeBlock size={setting.size} />
      <ShadowBlock shadowLevel={setting.shadowLevel} />
      <BorderBlock
        borderRadiusLevel={setting.borderRadiusLevel}
        linearBorderPos={setting.linearBorderPos}
        hasGlassBorder={setting.hasGlassBorder}
      />
      <RatioBlock ratio={setting.ratio} />
      <RotateBlock rotate={setting.rotate} />
      <LightBlock pos={setting.lightPos} />
      <BackgroundBlock
        wallpapers={setting.wallpapers}
        wallpaper={setting.wallpaper}
        direction={setting.direction}
      />
      <ActionBlock onDelete={onDelete} onReplace={onReplace} />
    </div>
  )
}

export default Toolbox
