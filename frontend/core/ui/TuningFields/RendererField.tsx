import type { ReactNode } from 'react'

import type { TGradientRenderer } from '~/lib/wallpaperMesh'

import { cn } from './salon/renderer_field'
import useSalon from './salon/renderer_field'

type TOption = {
  renderer: TGradientRenderer
  label: string
}

type Props = {
  label: ReactNode
  value: TGradientRenderer
  options: TOption[]
  onChange: (renderer: TGradientRenderer) => void
}

export default function RendererField({ label, value, options, onChange }: Props) {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, s.wrapperStart)}>
      <div className={cn(s.label, s.labelStart)}>{label}</div>
      <div className={cn(s.content, s.contentStart)}>
        <div className={s.renderers}>
          {options.map(({ renderer, label }) => {
            const selected = value === renderer

            return (
              <button
                type='button'
                key={renderer}
                className={cn(s.rendererButton, selected && s.rendererButtonActive)}
                aria-pressed={selected}
                onClick={() => onChange(renderer)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
