import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={52} height={52} viewBox="0 0 256 256" {...props}>
      <path d="M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16Zm0 160H40V56h176v144ZM80 84a12 12 0 1 1-12-12 12 12 0 0 1 12 12Zm40 0a12 12 0 1 1-12-12 12 12 0 0 1 12 12Z" />
    </svg>
  )
}

export default SVG
