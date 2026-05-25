export type TTopGlowBgLayerPreview =
  | false
  | {
      x?: string
      y?: string
      radius?: string
    }

export type TRadialTopGlowBgLayer = {
  type: 'radial'
  shape?: 'circle' | 'ellipse'
  color: string
  x: string
  y: string
  radius: string
  preview?: TTopGlowBgLayerPreview
}

export type TTopGlowBgLayer = TRadialTopGlowBgLayer

export type TTopGlowEffect = {
  layers: TTopGlowBgLayer[]
}
