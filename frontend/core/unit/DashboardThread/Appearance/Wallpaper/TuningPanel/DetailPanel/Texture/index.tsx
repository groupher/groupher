import { useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import { DEFAULT_WALLPAPER_TEXTURE_INTENSITY, type TWallpaperTexture } from '~/lib/wallpaperMesh'
import TextureIntensityField from '~/widgets/TuningFields/TextureIntensityField'
import TextureTypeField from '~/widgets/TuningFields/TextureTypeField'
import ToggleField from '~/widgets/TuningFields/ToggleField'

import useLogic from '../../../useLogic'
import useSalon from '../../salon/detail_panel/texture'
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
        <ToggleField
          label={t('dsb.appearance.wallpaper.editor.enable')}
          checked={hasTexture}
          onChange={onToggleTexture}
        />

        <TextureTypeField
          value={draftTexture.type}
          active={hasTexture}
          onChange={(type) => updateTexture({ type })}
        />

        {hasTexture && (
          <TextureIntensityField
            value={draftTexture.intensity}
            onChange={updateTextureIntensityDraft}
            onChangeEnd={commitTextureIntensity}
          />
        )}
      </div>
    </section>
  )
}
