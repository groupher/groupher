import ColorSelector from '~/widgets/ColorSelector'
import useTwBelt from '~/hooks/useTwBelt'
import { FIELD } from '../constant'
import useSubPrimaryColor from '../logic/useSubPrimaryColor'
import SavingBar from '../SavingBar'
import useSalon, { cn, cnMerge } from '../salon/layout/primary_color'

export default () => {
  const s = useSalon()
  const { rainbow } = useTwBelt()
  const { edit, subPrimaryColor, isTouched, saving } = useSubPrimaryColor()

  return (
    <div className={s.block}>
      <div className={cn(s.head, s.subHead)}>
        <div className={cnMerge(s.ballWrapper, s.subBall, rainbow(subPrimaryColor, 'borderSoft'))}>
          <ColorSelector
            activeColor={subPrimaryColor}
            onChange={(color) => edit(color, 'subPrimaryColor')}
            placement='right'
            offset={[-1, 15]}
          >
            <div className={cnMerge(s.colorBall, s.subColorBall, rainbow(subPrimaryColor, 'bg'))} />
          </ColorSelector>
        </div>
        <div className={s.title}>强调色</div>
      </div>
      <p className={s.desc}>未读提示，超链接，身份等级，状态标签等颜色</p>

      <SavingBar isTouched={isTouched} field={FIELD.SUB_PRIMARY_COLOR} loading={saving} top={6} />
    </div>
  )
}
