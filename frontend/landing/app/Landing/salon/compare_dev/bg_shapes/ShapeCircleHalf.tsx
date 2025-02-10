import { memo, type SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M16 4a8 8 0 1 0 0 16v-3a5 5 0 0 1 0-10V4Z" />
    </svg>
  )
}

export default memo(SVG)
