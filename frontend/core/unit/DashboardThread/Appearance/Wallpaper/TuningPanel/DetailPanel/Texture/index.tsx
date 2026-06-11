import { useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TBgTexture } from '~/lib/bg'
import { DEFAULT_WALLPAPER_TEXTURE_INTENSITY } from '~/lib/wallpaperMesh'
import TextureIntensityField from '~/widgets/TuningFields/TextureIntensityField'
import TextureTypeField from '~/widgets/TuningFields/TextureTypeField'
import ToggleField from '~/widgets/TuningFields/ToggleField'

import useLogic from '../../../useLogic'
import useSalon from '../../salon/detail_panel/texture'
import GroupTitle from '../GroupTitle'

type Props = {
  texture: TBgTexture
  onToggleTexture: (enabled: boolean) => void
}

export default function Texture({ texture, onToggleTexture }: Props) {
  const { t } = useTrans()
  const s = useSalon()
  const { changeTexture, flushWallpaperDraft } = useLogic()
  const [draftTexture, setDraftTexture] = useState<TBgTexture>({
    ...texture,
  })

  useEffect(() => {
    setDraftTexture(texture)
  }, [texture])

  const updateTexture = (patch: Partial<TBgTexture>): void => {
    const nextTexture = {
      ...draftTexture,
      ...patch,
      intensity:
        patch.type && !texture.enabled && draftTexture.intensity === 0
          ? DEFAULT_WALLPAPER_TEXTURE_INTENSITY
          : (patch.intensity ?? draftTexture.intensity),
      enabled: patch.enabled ?? (patch.type && !texture.enabled ? true : draftTexture.enabled),
    }

    setDraftTexture(nextTexture)
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
          checked={texture.enabled}
          onChange={onToggleTexture}
        />

        <TextureTypeField
          value={draftTexture.type}
          active={texture.enabled}
          onChange={(type) => updateTexture({ type })}
        />

        {texture.enabled && (
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
