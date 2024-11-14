import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={200}
      height={200}
      className="icon"
      viewBox="0 0 1024 1024"
      {...props}
    >
      <path d="M950.857 143.067H73.143v162.67h87.771v468.407h329.143v108.544h44.178V774.144h328.85V305.737h87.772v-162.67zM818.615 730.258H205.093v-424.52h613.522v424.52zm87.771-468.7H117.321v-74.02h789.065v74.02z" />
      <path d="m378.587 556.763 76.654-75.776 92.745 91.575 138.972-136.63-31.013-31.598-107.959 106.203-92.745-91.867-107.666 106.788z" />
    </svg>
  )
}

export default SVG
