import { memo, type SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      className="prefix__icon"
      xmlns="http://www.w3.org/2000/svg"
      width={200}
      height={200}
      viewBox="45 38 60 60"
      {...props}
    >
      <path d="M64.2 51.5C54.1 54.6 45.1 65.1 45 73.7c0 4.9 2.5 4.2 3.8-1 3-11.7 13.5-18.9 27.6-18.8 11.9 0 23.9 8.9 25.5 18.8.8 4.9 4.1 6 4.1 1.4 0-8.2-9.4-19.3-19-22.4-6.2-2-16.8-2.1-22.8-.2z" />
      <path d="M69.8 66.6c-7.3 3.9-7.5 15.1-.4 19.8 5.1 3.3 13.2 1.1 16.1-4.4 5.2-10.1-5.7-20.9-15.7-15.4zm10.7 4.9c7 6.9-3 17-10.2 10.3-3.3-3-3.1-8 .3-10.7 3.5-2.8 6.9-2.6 9.9.4z" />
    </svg>
  )
}

export default memo(SVG)
