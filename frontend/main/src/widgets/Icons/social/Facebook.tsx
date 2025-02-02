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
      <path
        d="M385.344 981.333 384 554.667H213.333V384H384V277.333c0-158.357 98.07-234.666 239.317-234.666 67.67 0 125.824 5.034 142.784 7.296v165.482l-97.984.043c-76.821 0-91.69 36.501-91.69 90.07V384H800l-85.333 170.667h-138.24v426.666H385.344z"
        fill="#39579A"
      />
    </svg>
  )
}

export default memo(SVG)
