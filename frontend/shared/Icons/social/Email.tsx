import { memo, type SVGProps } from 'react'

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
      <path d="M896 128H128c-46.933 0-85.333 38.4-85.333 85.333v597.334C42.667 857.6 81.067 896 128 896h768c46.933 0 85.333-38.4 85.333-85.333V213.333C981.333 166.4 942.933 128 896 128zm0 85.333v21.334l-384 268.8-384-268.8v-21.334h768zM128 810.667v-473.6L486.4 588.8c8.533 4.267 17.067 8.533 25.6 8.533s17.067-4.266 25.6-8.533L896 337.067v473.6H128z" />
    </svg>
  )
}

export default memo(SVG)
