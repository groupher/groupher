import ColorSelector from '~/widgets/ColorSelector'
import useTrans from '~/hooks/useTrans'
import { FIELD } from '../constant'
import usePrimaryColor from '../logic/usePrimaryColor'
import SubPrimaryColor from './SubPrimaryColor'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon from '../salon/layout/primary_color'

export default () => {
  const s = useSalon()
  const { edit, primaryColor, isTouched, saving } = usePrimaryColor()
  const { t } = useTrans()

  return (
    <section>
      <SectionLabel
        title={t('dsb.layout.primary_color.title')}
        desc={t('dsb.layout.primary_color.desc')}
      />
      <div className={s.content}>
        <div className={s.block}>
          <div className={s.head}>
            <div className={s.ballWrapper}>
              <ColorSelector
                activeColor={primaryColor}
                onChange={(color) => edit(color, 'primaryColor')}
                placement='right'
                offset={[-1, 15]}
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
