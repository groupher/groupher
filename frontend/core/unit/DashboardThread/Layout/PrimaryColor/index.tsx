import useTrans from '~/hooks/useTrans'
import ColorSelector from '~/widgets/ColorSelector'
import { FIELD } from '../../constant'
import usePrimaryColor from '../../logic/usePrimaryColor'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn } from '../../salon/layout/primary_color'
import SubPrimaryColor from '../SubPrimaryColor'

export default function PrimaryColor() {
  const s = useSalon()
  const { editPrimaryColor, editCustomColor, primaryColor, customColor, isTouched, saving } =
    usePrimaryColor()
  const { t } = useTrans()

  return (
    <section>
      <SectionLabel
        title={t('dsb.layout.primary_color.title')}
        desc={t('dsb.layout.primary_color.desc')}
      />
      <div className={s.content}>
        <div className={cn(s.block, 'pr-2')}>
          <div className={s.head}>
            <div className={s.ballWrapper}>
              <ColorSelector
                activeColor={primaryColor}
                customColor={customColor}
                onChange={editPrimaryColor}
                onCustomColorChange={editCustomColor}
                allowCustom
                placement='right'
                offset={[-1, 24]}
              >
                <div className={s.colorBall} />
              </ColorSelector>
            </div>
            <div className={s.title}>{t('dsb.layout.primary_color.label')}</div>
          </div>
          <p className={s.desc}>{t('dsb.layout.primary_color.hint')}</p>

          <SavingBar isTouched={isTouched} field={FIELD.PRIMARY_COLOR} loading={saving} top={6} />
        </div>

        <SubPrimaryColor />
      </div>
    </section>
  )
}
