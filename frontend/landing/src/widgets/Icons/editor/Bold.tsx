import { memo, type SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 256 256" {...props}>
      <path d="M170.48 115.7A44 44 0 0 0 140 40H72a8 8 0 0 0-8 8v152a8 8 0 0 0 8 8h80a48 48 0 0 0 18.48-92.3ZM80 56h60a28 28 0 0 1 0 56H80Zm72 136H80v-64h72a32 32 0 0 1 0 64Z" />
    </svg>
  )
}

export default memo(SVG)
