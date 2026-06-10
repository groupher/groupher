import { COLOR } from '~/const/colors'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import useTheme from '~/hooks/useTheme'
import {
  composeColorChips,
  findPresetColor,
  getGradientSpreadValue,
  applyGradientSpreadValue,
} from '~/lib/bg'
import type { TBgConfig } from '~/lib/bg'
import { mapToPresetColorHex } from '~/lib/color'
import {
  GRADIENT_RENDERER,
  WALLPAPER_GRADIENT_RENDERER_OPTIONS,
  type TGradientRecipe,
  type TGradientRenderer,
  type TWallpaperTexture,
} from '~/lib/wallpaperMesh'
import type { TColorName } from '~/spec'
import AngleField from '~/widgets/TuningFields/AngleField'
import BlurField from '~/widgets/TuningFields/BlurField'
import BrightnessField from '~/widgets/TuningFields/BrightnessField'
import ColorsField from '~/widgets/TuningFields/ColorsField'
import RendererField from '~/widgets/TuningFields/RendererField'
import SaturationField from '~/widgets/TuningFields/SaturationField'
import SpreadField from '~/widgets/TuningFields/SpreadField'
import TextureIntensityField from '~/widgets/TuningFields/TextureIntensityField'
import TextureTypeField from '~/widgets/TuningFields/TextureTypeField'
import ToggleField from '~/widgets/TuningFields/ToggleField'

import useLogic from '../../../useLogic'
import useSalon from './salon/tuning'

type TProps = {
  background: TBgConfig
}

export default function Tuning({ background }: TProps) {
  const s = useSalon()
  const { theme } = useTheme()
  const {
    backgroundOnChange,
    backgroundGradientAngleOnChange,
    backgroundGradientOnChange,
    backgroundGradientRendererOnChange,
    backgroundTextureOnChange,
    toggleBackgroundTexture,
  } = useLogic()
  const isGradient = background.type === WALLPAPER_TYPE.GRADIENT && background.gradient
  const gradient = background.gradient
  const rendererOptions = WALLPAPER_GRADIENT_RENDERER_OPTIONS.filter(
    ({ renderer }) => renderer !== GRADIENT_RENDERER.FLOW,
  )

  const updateGradient = (nextGradient: TGradientRecipe): void =>
    backgroundGradientOnChange(nextGradient)

  const updateColor = (index: number, color: string): void => {
    if (!gradient) return

    updateGradient({
      ...gradient,
      colors: gradient.colors.map((value, valueIndex) => (valueIndex === index ? color : value)),
    })
  }

  const updatePresetColor = (index: number, color: TColorName): void => {
    if (color === COLOR.CUSTOM) return
    updateColor(index, mapToPresetColorHex(color, theme))
  }

  const updateTexture = (patch: Partial<TWallpaperTexture>): void =>
    backgroundTextureOnChange({ ...background.texture, ...patch })

  return (
    <div className={s.tuningGrid}>
      <div className={s.tuningColumn}>
        <BrightnessField
          label='Brightness'
          value={background.brightness}
          width='w-36'
          onChange={(brightness) => backgroundOnChange({ brightness })}
        />

        <SaturationField
          label='Saturation'
          value={background.saturation}
          width='w-36'
          onChange={(saturation) => backgroundOnChange({ saturation })}
        />

        <BlurField
          label='Blur'
          value={background.blurIntensity}
          width='w-36'
          onChange={(blurIntensity) => backgroundOnChange({ blurIntensity })}
        />
      </div>

      <div className={s.tuningColumn}>
        <ToggleField
          label='Texture'
          checked={background.hasTexture}
          onChange={toggleBackgroundTexture}
        />

        <TextureTypeField
          label='Type'
          value={background.texture.type}
          active={background.hasTexture}
          onChange={(type) => updateTexture({ type })}
        />

        {background.hasTexture && (
          <TextureIntensityField
            label='Intensity'
            value={background.texture.intensity}
            width='w-36'
            onChange={(intensity) => updateTexture({ intensity })}
          />
        )}
      </div>

      {isGradient && gradient && (
        <div className={s.gradientTuning}>
          <div className={s.tuningColumn}>
            <ColorsField
              label='Colors'
              chips={composeColorChips(gradient).map(({ color, index, key }) => ({
                color,
                activeColor: findPresetColor(color, theme),
                key,
                label: `Change gradient color ${index + 1}`,
                onChange: (selectedColor) => updatePresetColor(index, selectedColor),
                onCustomColorChange: (customColor) => updateColor(index, customColor),
              }))}
            />

            <RendererField
              label='Renderer'
              value={gradient.renderer}
              options={rendererOptions.map(({ renderer, labelKey }) => ({
                renderer,
                label: labelKey.split('.').at(-1) ?? labelKey,
              }))}
              onChange={(renderer) =>
                backgroundGradientRendererOnChange(renderer as TGradientRenderer)
              }
            />
          </div>

          <div className={s.tuningColumn}>
            <SpreadField
              label='Spread'
              value={getGradientSpreadValue(gradient)}
              width='w-36'
              onChange={(spread) => updateGradient(applyGradientSpreadValue(gradient, spread))}
            />

            {gradient.renderer !== GRADIENT_RENDERER.RADIAL && (
              <AngleField
                value={gradient.angle}
                onChange={backgroundGradientAngleOnChange}
                onCommit={() => {}}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
