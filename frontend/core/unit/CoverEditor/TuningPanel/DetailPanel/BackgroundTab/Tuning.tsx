import { COLOR } from '~/const/colors'
import SIZE from '~/const/size'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { cn } from '~/css'
import useTheme from '~/hooks/useTheme'
import {
  buildColorChips,
  findPresetColor,
  getGradientSpreadValue,
  applyGradientSpreadValue,
  resolvePresetColor,
} from '~/lib/bg/gradient'
import type { TBgConfig } from '~/lib/bg/spec'
import {
  GRADIENT_RENDERER,
  WALLPAPER_GRADIENT_RENDERER_OPTIONS,
  type TGradientRecipe,
  type TGradientRenderer,
  type TWallpaperTexture,
} from '~/lib/wallpaperMesh'
import type { TColorName } from '~/spec'
import TextureStylePicker from '~/unit/DashboardThread/Appearance/Wallpaper/TextureStylePicker'
import AngleWheelControl from '~/widgets/AngleWheel'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import ColorSelector from '~/widgets/ColorSelector'
import ColorsPresetBall from '~/widgets/ColorsPresetBall'
import RangeInput from '~/widgets/RangeInput'

import useLogic from '../../../useLogic'
import GroupItem from '../GroupItem'
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
    updateColor(index, resolvePresetColor(color, theme))
  }

  const updateTexture = (patch: Partial<TWallpaperTexture>): void =>
    backgroundTextureOnChange({ ...background.texture, ...patch })

  return (
    <div className={s.tuningGrid}>
      <div className={s.tuningColumn}>
        <GroupItem label='Brightness'>
          <RangeInput
            value={background.brightness}
            min={60}
            max={140}
            step={5}
            width='w-36'
            hideLabel
            valueLabel='Brightness'
            aria-label='Brightness'
            onChange={(brightness) => backgroundOnChange({ brightness })}
          />
        </GroupItem>

        <GroupItem label='Saturation'>
          <RangeInput
            value={background.saturation}
            min={0}
            max={160}
            step={5}
            width='w-36'
            hideLabel
            valueLabel='Saturation'
            aria-label='Saturation'
            onChange={(saturation) => backgroundOnChange({ saturation })}
          />
        </GroupItem>

        <GroupItem label='Blur'>
          <RangeInput
            value={background.blurIntensity}
            min={0}
            max={100}
            step={5}
            width='w-36'
            hideLabel
            valueLabel='Blur'
            aria-label='Blur'
            onChange={(blurIntensity) => backgroundOnChange({ blurIntensity })}
          />
        </GroupItem>
      </div>

      <div className={s.tuningColumn}>
        <GroupItem label='Texture'>
          <ToggleSwitch
            size={SIZE.TINY}
            checked={background.hasTexture}
            aria-label='Enable texture'
            onChange={toggleBackgroundTexture}
          />
        </GroupItem>

        <GroupItem label='Type'>
          <TextureStylePicker
            value={background.texture.type}
            active={background.hasTexture}
            showLabel={false}
            onChange={(type) => updateTexture({ type })}
          />
        </GroupItem>

        {background.hasTexture && (
          <GroupItem label='Intensity'>
            <RangeInput
              value={background.texture.intensity}
              min={0}
              max={100}
              step={1}
              width='w-36'
              hideLabel
              valueLabel='Texture intensity'
              aria-label='Texture intensity'
              onChange={(intensity) => updateTexture({ intensity })}
            />
          </GroupItem>
        )}
      </div>

      {isGradient && gradient && (
        <div className={s.gradientTuning}>
          <div className={s.tuningColumn}>
            <GroupItem label='Colors'>
              <div className={s.colorChips}>
                {buildColorChips(gradient).map(({ color, index, key }) => (
                  <ColorSelector
                    key={key}
                    activeColor={findPresetColor(color, theme)}
                    customColor={color}
                    allowCustomColor
                    placement='top'
                    onChange={(selectedColor) => updatePresetColor(index, selectedColor)}
                    onCustomColorChange={(customColor) => updateColor(index, customColor)}
                  >
                    <ColorsPresetBall
                      colors={[color]}
                      interactive
                      label={`Change gradient color ${index + 1}`}
                      size={SIZE.SMALL}
                    />
                  </ColorSelector>
                ))}
              </div>
            </GroupItem>

            <GroupItem label='Renderer' align='start'>
              <div className={s.rendererGrid}>
                {rendererOptions.map(({ renderer, labelKey }) => {
                  const selected = gradient.renderer === renderer

                  return (
                    <button
                      type='button'
                      key={renderer}
                      className={cn(s.rendererButton, selected && s.rendererButtonActive)}
                      aria-pressed={selected}
                      onClick={() =>
                        backgroundGradientRendererOnChange(renderer as TGradientRenderer)
                      }
                    >
                      {labelKey.split('.').at(-1)}
                    </button>
                  )
                })}
              </div>
            </GroupItem>
          </div>

          <div className={s.tuningColumn}>
            <GroupItem label='Spread'>
              <RangeInput
                value={getGradientSpreadValue(gradient)}
                min={0}
                max={100}
                step={1}
                width='w-36'
                hideLabel
                valueLabel='Gradient spread'
                aria-label='Gradient spread'
                onChange={(spread) => updateGradient(applyGradientSpreadValue(gradient, spread))}
              />
            </GroupItem>

            {gradient.renderer !== GRADIENT_RENDERER.RADIAL && (
              <GroupItem label='Direction'>
                <div className={s.angle}>
                  <AngleWheelControl
                    value={gradient.angle}
                    onChange={backgroundGradientAngleOnChange}
                    onCommit={() => {}}
                  />
                </div>
              </GroupItem>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
