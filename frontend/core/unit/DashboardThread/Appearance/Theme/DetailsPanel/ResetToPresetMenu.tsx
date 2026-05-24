import { type FC, memo, useCallback, useMemo } from 'react'

import { THEME_PRESET } from '~/const/theme_preset'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import type { TTransKey } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import useSalon from '../salon/details_panel/reset_to_preset_menu'
import type { TThemePresetOption } from '../spec'

type TProps = {
  activePresetBase: TThemePresetOption['value']
  presetOptions: readonly TThemePresetOption[]
  onReset: (preset: TThemePresetOption) => void
}

const ResetToPresetMenu: FC<TProps> = ({ activePresetBase, presetOptions, onReset }) => {
  const s = useSalon()
  const { t } = useTrans()

  const options = useMemo(
    () =>
      presetOptions.reduce<Array<TThemePresetOption & { isBase: boolean }>>((options, preset) => {
        if (preset.value === THEME_PRESET.CUSTOM) return options

        options.push({
          ...preset,
          isBase: preset.value === activePresetBase,
        })

        return options
      }, []),
    [activePresetBase, presetOptions],
  )

  const getPresetTitle = useCallback(
    (preset: TThemePresetOption) => {
      const presetKey = preset.value.toLowerCase()

      return t(`dsb.appearance.theme.preset.${presetKey}.title` as TTransKey)
    },
    [t],
  )

  const content = (
    <div className={s.menu}>
      {options.map((preset) => {
        const presetTitle = getPresetTitle(preset)

        return (
          <button
            key={preset.value}
            type='button'
            className={s.menuItem}
            onClick={() => onReset(preset)}
          >
            <span className={s.menuTitle}>
              {t('dsb.appearance.theme.reset_to')} &quot;{presetTitle}&quot;
              {preset.isBase && (
                <span className={s.based}> ({t('dsb.appearance.theme.based')})</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <Tooltip
      trigger='click'
      placement='bottom-end'
      offset={[0, 8]}
      content={content}
      noPadding
      hideOnClick
    >
      <button type='button' className={s.trigger}>
        <span className={s.triggerText}>{t('dsb.appearance.theme.reset_to')}</span>
        <ArrowSVG className={s.triggerIcon} />
      </button>
    </Tooltip>
  )
}

export default memo(ResetToPresetMenu)
