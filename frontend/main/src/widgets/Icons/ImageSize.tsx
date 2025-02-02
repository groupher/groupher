import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      className="icon"
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      width={200}
      height={200}
      {...props}
    >
      <path d="m512.213 234.667-85.546 106.666h170.666l-85.12-106.666zm255.787 192v170.666l106.667-85.12L768 426.667zm-512 0-106.667 85.546L256 597.333V426.667zm341.333 256H426.667l85.546 106.666 85.12-106.666zM896 128H128c-47.147 0-85.333 38.187-85.333 85.333v597.334C42.667 857.813 80.853 896 128 896h768c47.147 0 85.333-38.187 85.333-85.333V213.333C981.333 166.187 943.147 128 896 128zm0 683.307H128V212.693h768v598.614z" />
    </svg>
  )
}

export default SVG
