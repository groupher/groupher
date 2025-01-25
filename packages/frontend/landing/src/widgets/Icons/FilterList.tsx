import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 256 256" {...props}>
      <path d="M198 128a6 6 0 0 1-6 6H64a6 6 0 0 1 0-12h128a6 6 0 0 1 6 6Zm34-54H24a6 6 0 0 0 0 12h208a6 6 0 0 0 0-12Zm-80 96h-48a6 6 0 0 0 0 12h48a6 6 0 0 0 0-12Z" />
    </svg>
  )
}

export default SVG
