import { useEffect, useState } from 'react'

import SIZE from '~/const/size'
import useTrans from '~/hooks/useTrans'
import { DEFAULT_WALLPAPER_TEXTURE_INTENSITY, type TWallpaperTexture } from '~/lib/wallpaperMesh'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import RangeInput from '~/widgets/RangeInput'

import TextureStylePicker from '../../../TextureStylePicker'
import useLogic from '../../../useLogic'
import useSalon from '../../salon/detail_panel/texture'
import GroupItem from '../GroupItem'
import GroupTitle from '../GroupTitle'

type Props = {
  hasTexture: boolean
  texture: TWallpaperTexture
  onToggleTexture: (hasTexture: boolean) => void
}

export default function Texture({ hasTexture, texture, onToggleTexture }: Props) {
  const { t } = useTrans()
  const s = useSalon()
  const { changeTexture, flushWallpaperDraft } = useLogic()
  const [draftTexture, setDraftTexture] = useState<TWallpaperTexture>({
    ...texture,
  })

  useEffect(() => {
    setDraftTexture(texture)
  }, [texture])

  const updateTexture = (patch: Partial<TWallpaperTexture>): void => {
    const nextTexture = {
      ...draftTexture,
      ...patch,
      intensity:
        patch.type && !hasTexture && draftTexture.intensity === 0
          ? DEFAULT_WALLPAPER_TEXTURE_INTENSITY
          : (patch.intensity ?? draftTexture.intensity),
    }

    setDraftTexture(nextTexture)
    if (!hasTexture) onToggleTexture(true)
    changeTexture(nextTexture)
    flushWallpaperDraft()
  }

  const updateTextureIntensityDraft = (intensity: number): void => {
    const nextTexture = { ...draftTexture, intensity }

    setDraftTexture(nextTexture)
    changeTexture(nextTexture)
  }

  const commitTextureIntensity = (intensity: number): void => {
    const nextTexture = { ...draftTexture, intensity }

    setDraftTexture(nextTexture)
    changeTexture(nextTexture)
    flushWallpaperDraft()
  }

  return (
    <section className={s.wrapper}>
      <GroupTitle>{t('dsb.appearance.wallpaper.texture')}</GroupTitle>

      <div className={s.items}>
        <GroupItem label={t('dsb.appearance.wallpaper.editor.enable')}>
          <ToggleSwitch
            size={SIZE.TINY}
            checked={hasTexture}
            aria-label={t('dsb.appearance.wallpaper.editor.enable')}
            onChange={onToggleTexture}
          />
        </GroupItem>

        <GroupItem label={t('dsb.appearance.wallpaper.editor.type')}>
          <TextureStylePicker
            value={draftTexture.type}
            active={hasTexture}
            showLabel={false}
            onChange={(type) => updateTexture({ type })}
          />
        </GroupItem>

        {hasTexture && (
          <GroupItem label={t('dsb.appearance.wallpaper.texture.intensity')}>
            <RangeInput
              value={draftTexture.intensity}
              min={0}
              max={100}
              step={1}
              hideLabel
              valueLabel={t('dsb.appearance.wallpaper.texture.intensity')}
              aria-label={t('dsb.appearance.wallpaper.texture.intensity')}
              onChange={updateTextureIntensityDraft}
              onChangeEnd={commitTextureIntensity}
            />
          </GroupItem>
        )}
      </div>
    </section>
  )
}
