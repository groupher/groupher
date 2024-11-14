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
      <path d="M883.84 211.499v186.41a96 96 0 0 1-96 96H534.827v49.174h7.637a64 64 0 0 1 64 64v203.584a64 64 0 0 1-64 64h-79.253a64 64 0 0 1-64-64V607.083a64 64 0 0 1 64-64h7.616V429.909H787.84a32 32 0 0 0 32-32V211.5h64zm-156.075-62.166a64 64 0 0 1 64 64v120.683a64 64 0 0 1-64 64H213.333a64 64 0 0 1-64-64V213.333a64 64 0 0 1 64-64h514.432z" />
    </svg>
  )
}

export default SVG
