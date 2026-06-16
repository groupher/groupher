import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='currentColor' {...props}>
      <path d='M145.76 160 128.96 96H54l-16.8 64Zm-118 16a8 8 0 0 1-7.74-10.04l19.56-74.3A15.9 15.9 0 0 1 54 80h74.96a15.9 15.9 0 0 1 14.42 11.66L161.32 160H202a8 8 0 0 1 0 16Zm190-136a8 8 0 0 1 8 8v32h30a8 8 0 0 1 0 16h-30v32a8 8 0 0 1-16 0V96h-30a8 8 0 0 1 0-16h30V48a8 8 0 0 1 8-8' />
    </svg>
  )
}

export default SVG
