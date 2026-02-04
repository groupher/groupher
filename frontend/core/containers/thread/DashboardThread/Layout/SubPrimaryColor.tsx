import ColorSelector from '~/widgets/ColorSelector'
import useTwBelt from '~/hooks/useTwBelt'
import useTrans from '~/hooks/useTrans'
import { FIELD } from '../constant'
import useSubPrimaryColor from '../logic/useSubPrimaryColor'
import SavingBar from '../SavingBar'
import useSalon, { cn, cnMerge } from '../salon/layout/primary_color'

export default () => {
  const s = useSalon()
  const { rainbow } = useTwBelt()
  const { edit, subPrimaryColor, isTouched, saving } = useSubPrimaryColor()
  const { t } = useTrans()

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
        <div className={s.title}>{t('dsb.layout.sub_primary_color.title')}</div>
      </div>
      <p className={s.desc}>{t('dsb.layout.sub_primary_color.desc')}</p>

      <SavingBar isTouched={isTouched} field={FIELD.SUB_PRIMARY_COLOR} loading={saving} top={6} />
    </div>
  )
}
