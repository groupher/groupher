import type { TCoverScene } from '../../../const/coverScenes'
import { useCoverScene } from '../../../stores/coverScene/context'
import WallpaperTileVisual from './WallpaperTileVisual'

type TProps = {
  scene: TCoverScene
  heightTier: number
}

export default function StaticWallpaperTile({ scene, heightTier }: TProps) {
  const { selectScene } = useCoverScene()

  return (
    <button
      type='button'
      className='cover-scene-rail'
      data-height-tier={heightTier}
      data-scene-id={scene.id}
      data-wallpaper-type={scene.wallpaperType}
      aria-label={`Preview ${scene.label}`}
      onClick={() => selectScene(scene.id)}
    >
      <WallpaperTileVisual scene={scene} panDistance={0} />
    </button>
  )
}
