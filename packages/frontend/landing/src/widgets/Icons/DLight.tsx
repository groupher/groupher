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
      <path d="M504.1 451.2h-15.6v-45.1h46.8V451h-15.6v-29.3h-15.6z" />
      <path d="M583.4 532.8h-15.6v-33.1c0-25.8-24.5-46.8-54.6-46.8s-54.6 21-54.6 46.8v30.2H443v-30.2c0-34.4 31.5-62.4 70.2-62.4s70.2 28 70.2 62.4v33.1z" />
      <path d="M874.5 881.8h-15.6c0-193.5-157.4-350.9-350.9-350.9S157.1 688.3 157.1 881.8h-15.6c0-202.1 164.4-366.5 366.5-366.5s366.5 164.4 366.5 366.5z" />
      <path d="M897.9 913H118.1v-46.8h779.8V913zm-764.2-15.6h748.6v-15.6H133.7v15.6z" />
      <path d="M511.9 413.9V102" />
      <path d="M504.1 102h15.6v311.9h-15.6zM151.4 838.7h714v7.8h-714z" />
    </svg>
  )
}

export default SVG
