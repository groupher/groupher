import useTrans from '~/hooks/useTrans'
import useTwBelt from '~/hooks/useTwBelt'
import ColorSelector from '~/widgets/ColorSelector'

import useSubPrimaryColor from '../../logic/useSubPrimaryColor'
import useSalon, { cn, cnMerge } from '../../salon/layout/primary_color'
import SavingBar from '../../SavingBar'

export default function SubPrimaryColor() {
  const s = useSalon()
  const { subPrimary } = useTwBelt()
  const {
    editSubPrimaryColor,
    editCustomColor,
    subPrimaryColor,
    customColor,
    isTouched,
    onCancel,
    onConfirm,
  } = useSubPrimaryColor()
  const { t } = useTrans()

  return (
    <div className={cn(s.block, 'pl-2')}>
      <div className={cn(s.head, s.subHead)}>
        <div className={cnMerge(s.ballWrapper, s.subBall, subPrimary('borderSoft'))}>
          <ColorSelector
            activeColor={subPrimaryColor}
            customColor={customColor}
            onChange={editSubPrimaryColor}
            onCustomColorChange={editCustomColor}
            allowCustomColor
            placement='right'
            offset={[-1, 15]}
          >
            <div className={cnMerge(s.colorBall, s.subColorBall, subPrimary('bg'))} />
          </ColorSelector>
        </div>
        <div className={s.title}>{t('dsb.layout.sub_primary_color.title')}</div>
      </div>
      <p className={s.desc}>{t('dsb.layout.sub_primary_color.desc')}</p>

      <SavingBar isTouched={isTouched} top={6} onCancel={onCancel} onConfirm={onConfirm} />
    </div>
  )
}
