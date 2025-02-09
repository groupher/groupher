import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      className="icon"
      transform="rotate(-85)"
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      width={200}
      height={200}
      {...props}
    >
      <path d="M768 298.667c0-25.6-17.067-42.667-42.667-42.667s-42.666 17.067-42.666 42.667v324.266L328.533 268.8c-17.066-17.067-42.666-17.067-59.733 0s-17.067 42.667 0 59.733l354.133 354.134H298.667c-25.6 0-42.667 17.066-42.667 42.666S273.067 768 298.667 768h426.666c4.267 0 12.8 0 17.067-4.267 8.533-4.266 17.067-12.8 21.333-21.333C768 738.133 768 729.6 768 725.333V298.667z" />
    </svg>
  )
}

export default SVG
