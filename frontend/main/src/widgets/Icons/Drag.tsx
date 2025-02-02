import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 256 256" {...props}>
      <path d="M188 80a27.79 27.79 0 0 0-13.36 3.4 28 28 0 0 0-46.64-11A28 28 0 0 0 80 92v20H68a28 28 0 0 0-28 28v12a88 88 0 0 0 176 0v-44a28 28 0 0 0-28-28Zm12 72a72 72 0 0 1-144 0v-12a12 12 0 0 1 12-12h12v24a8 8 0 0 0 16 0V92a12 12 0 0 1 24 0v28a8 8 0 0 0 16 0V92a12 12 0 0 1 24 0v28a8 8 0 0 0 16 0v-12a12 12 0 0 1 24 0Z" />
    </svg>
  )
}

export default SVG
