import useTrans from '~/hooks/useTrans'
import useTwBelt from '~/hooks/useTwBelt'
import ColorSelector from '~/widgets/ColorSelector'

import { FIELD } from '../../constant'
import usePrimaryColorSalon, { cn as primaryCn, cnMerge } from '../../salon/layout/primary_color'
import type { TEditDashboardField, TThemePresetOverrides } from './spec'

type TProps = {
  selectedOverrides: TThemePresetOverrides
  primaryCustomColor: string
  isLightTheme: boolean
  editField: TEditDashboardField
}

export default function PrimaryColors({
  selectedOverrides,
  primaryCustomColor,
  isLightTheme,
  editField,
}: TProps) {
  const primaryColorS = usePrimaryColorSalon()
  const { t } = useTrans()
  const { subPrimary } = useTwBelt()

  return (
    <div className={primaryColorS.content}>
      <div className={primaryCn(primaryColorS.block, 'pr-2')}>
        <div className={primaryColorS.head}>
          <div className={primaryColorS.ballWrapper}>
            <ColorSelector
              activeColor={selectedOverrides.primaryColor}
              customColor={primaryCustomColor}
              allowCustomColor
              onChange={(primaryColor) => editField(FIELD.PRIMARY_COLOR, primaryColor)}
              onCustomColorChange={(color) => {
                editField(
                  isLightTheme ? FIELD.PRIMARY_CUSTOM_COLOR : FIELD.PRIMARY_CUSTOM_COLOR_DARK,
                  color,
                )
              }}
            >
              <div className={primaryColorS.colorBall} />
            </ColorSelector>
          </div>
          <div className={primaryColorS.title}>{t('dsb.layout.primary_color.label')}</div>
        </div>
        <p className={primaryColorS.desc}>{t('dsb.layout.primary_color.hint')}</p>
      </div>

      <div className={primaryCn(primaryColorS.block, 'pl-2')}>
        <div className={primaryCn(primaryColorS.head, primaryColorS.subHead)}>
          <div
            className={cnMerge(
              primaryColorS.ballWrapper,
              primaryColorS.subBall,
              subPrimary('borderSoft'),
            )}
          >
            <ColorSelector
              activeColor={selectedOverrides.subPrimaryColor}
              onChange={(subPrimaryColor) => editField(FIELD.SUB_PRIMARY_COLOR, subPrimaryColor)}
            >
              <div
                className={cnMerge(
                  primaryColorS.colorBall,
                  primaryColorS.subColorBall,
                  subPrimary('bg'),
                )}
              />
            </ColorSelector>
          </div>
          <div className={primaryColorS.title}>{t('dsb.layout.sub_primary_color.title')}</div>
        </div>
        <p className={primaryColorS.desc}>{t('dsb.layout.sub_primary_color.desc')}</p>
      </div>
    </div>
  )
}
