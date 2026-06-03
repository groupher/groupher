import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d='M12 3v12' />
    <path d='m8 11 4 4 4-4' />
    <path d='M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4' />
  </IconBase>
)

export default SVG
