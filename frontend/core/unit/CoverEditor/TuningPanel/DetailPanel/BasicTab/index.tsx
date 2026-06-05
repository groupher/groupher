import type { TTuningSetting } from '../../../spec'
import GroupTitle from '../GroupTitle'
import Border from './Border'
import Light from './Light'
import Position from './Position'
import Ratio from './Ratio'
import Rotate from './Rotate'
import useSalon from './salon'
import Shadow from './Shadow'
import Size from './Size'

type TProps = {
  setting: TTuningSetting
}

export default function BasicTab({ setting }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.column}>
        <section className={s.group}>
          <GroupTitle>Transform</GroupTitle>

          <div className={s.items}>
            <Position
              position={setting.position}
              size={setting.size}
              ratio={setting.ratio}
              rotate={setting.rotate}
            />
            <Size size={setting.size} />
            <Ratio ratio={setting.ratio} />
            <Rotate rotate={setting.rotate} />
          </div>
        </section>
      </div>

      <div className={s.column}>
        <section className={s.group}>
          <GroupTitle>Style</GroupTitle>

          <div className={s.items}>
            <Shadow shadowLevel={setting.shadowLevel} />
            <Border
              borderRadiusLevel={setting.borderRadiusLevel}
              borderHighlight={setting.borderHighlight}
              hasGlassBorder={setting.hasGlassBorder}
            />
          </div>
        </section>

        <section className={s.group}>
          <GroupTitle>Lighting</GroupTitle>

          <div className={s.items}>
            <Light center={setting.lightCenter} enabled={setting.hasLight} />
          </div>
        </section>
      </div>
    </div>
  )
}
