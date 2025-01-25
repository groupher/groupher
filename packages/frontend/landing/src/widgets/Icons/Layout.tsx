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
      <path d="M880.64 20.48H143.36A122.88 122.88 0 0 0 20.48 143.36v737.28a122.88 122.88 0 0 0 122.88 122.88h737.28a122.88 122.88 0 0 0 122.88-122.88V143.36A122.88 122.88 0 0 0 880.64 20.48zm-737.28 51.2h737.28a71.68 71.68 0 0 1 71.68 71.68v136.602H71.68V143.36a71.68 71.68 0 0 1 71.68-71.68zM71.68 880.64V331.162h307.2V952.32H143.36a71.68 71.68 0 0 1-71.68-71.68zm808.96 71.68H430.08V331.162h522.24V880.64a71.68 71.68 0 0 1-71.68 71.68z" />
    </svg>
  )
}

export default SVG
