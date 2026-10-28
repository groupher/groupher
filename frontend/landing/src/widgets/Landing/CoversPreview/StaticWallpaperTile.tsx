import { COVER_SCENES, type TCoverScene } from '../../../const/coverScenes'
import { useCoverScene } from '../../../stores/coverScene/context'
import useWallpaperHoverPan from './useWallpaperHoverPan'
import { getWallpaperTileMotion } from './wallpaperTileMotion'
import WallpaperTileVisual from './WallpaperTileVisual'

const MOTION_BY_SCENE = getWallpaperTileMotion(COVER_SCENES)

type TProps = {
  scene: TCoverScene
  heightTier: number
}

export default function StaticWallpaperTile({ scene, heightTier }: TProps) {
  const { selectScene } = useCoverScene()
  const hoverDistance = -Math.sign(MOTION_BY_SCENE[scene.id].imagePanDistance) * 24
  const { pan, setHovered } = useWallpaperHoverPan(hoverDistance)

  return (
    <button
      type='button'
      className='cover-scene-rail duration-200'
      data-height-tier={heightTier}
      data-scene-id={scene.id}
      data-wallpaper-type={scene.wallpaperType}
      aria-label={`Preview ${scene.label}`}
      onClick={() => selectScene(scene.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <WallpaperTileVisual scene={scene} panDistance={24} imagePan={pan} />
    </button>
  )
}
