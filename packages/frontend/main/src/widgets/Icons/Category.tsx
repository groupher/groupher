import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={200}
    height={200}
    className="icon"
    viewBox="0 0 1024 1024"
    {...props}
  >
    <path d="m512 85.333-234.667 384h469.334L512 85.333zm0 163.84L594.347 384h-165.12L512 249.173zm234.667 305.494c-106.24 0-192 85.76-192 192s85.76 192 192 192 192-85.76 192-192-85.76-192-192-192zm0 298.666a106.667 106.667 0 0 1 0-213.333 106.667 106.667 0 0 1 0 213.333zM469.333 576H128v341.333h341.333V576zM384 832H213.333V661.333H384V832z" />
  </svg>
)

export default SVG
