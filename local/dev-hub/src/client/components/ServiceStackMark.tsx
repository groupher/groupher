import type { TTechnology, TTechnologyStack } from '@shared/contracts'
import { Server } from 'lucide-react'
import {
  siElixir,
  siFastapi,
  siGraphql,
  siNextdotjs,
  siNodedotjs,
  siOpenid,
  siPhoenixframework,
  siReact,
  siTailwindcss,
  siTypescript,
} from 'simple-icons'

import authjsLogoUrl from '../assets/authjs-logo.webp'
import honoLogoUrl from '../assets/hono-logo.svg'
import postgresqlLogoUrl from '../assets/postgresql-logo.svg'
import pythonLogoUrl from '../assets/python-logo.svg'

type TProps = {
  name: string
  monogram: string
  technologies: TTechnologyStack | null
}

type TIconDefinition = {
  title: string
  path: string
  viewBox: string
  color: string
  underlayPath?: string
  underlayColor?: string
  outlineColor?: string
  outlineWidth?: number
  assetUrl?: string
}

const SIMPLE_ICON_VIEWBOX = '0 0 24 24'
const CIRCLE_UNDERLAY_PATH = 'M12 0a12 12 0 1 0 0 24 12 12 0 1 0 0-24z'
const SQUARE_UNDERLAY_PATH = 'M0 0h24v24H0z'
const MARKITDOWN_PATH =
  'M193 128H15a15 15 0 0 1-15-15V15A15 15 0 0 1 15 0h178a15 15 0 0 1 15 15v98a15 15 0 0 1-15 15zM50 98V59l20 25 20-25v39h20V30H90L70 55 50 30H30v68zm134-34-30-34v20h-20v28h20v-20z'
const ABSINTHE_PATHS = [
  'M39.6 67.6c-1.2 0-2.5 3.5-8.2 4.7 1.9-5.1 3.8-11.2 5.6-17.1 3.2 1.1 6.3 2.4 9.3 3.3v15.8c0 1.7-.1 3.8-2.8 3.8h-.9v1.2h13.8v-1.2h-.7c-2.5 0-2.7-2.1-2.7-3.8V59.8h1.4c2.4 0 3.7-.5 3.7-1.9 0-.5-.3-.9-.6-.9-.8 0 .6 1.6-3.1 1.6H53V28.2c0-1.2.5-2.1 2.1-2.1h.4v-1.4h-1c-9.4 0-14.7 14.3-19.2 28.6-2.9-.9-5.9-1.5-9.3-1.5-7.3 0-15.5 2.9-15.5 10.5 0 8.6 10.6 11.5 18 11.3-3.5 7.8-8.7 17.3-17.1 17.3-3.8 0-6.8-1.9-6.8-4.7 0-1.4 1-1.9 1.7-1.9.5 0 1.1.2 1.4.4.6-.9.9-1.9.9-2.6 0-1.8-1.2-3.7-3.7-3.7-2.7 0-4.9 2.2-4.9 5.4 0 5.5 4.8 8.9 10.8 8.9 11.1 0 16.7-10.9 20.2-19.4 5.7-.9 9.1-3.7 9.1-5 .1-.5-.1-.7-.5-.7zm-25.7-4.8c0-7.1 7.3-9.4 13.5-9.4 2.7 0 5.2.5 7.6 1.2-2.1 6.6-4 13-6 18.1-7.6.3-15.1-3.1-15.1-9.9zm32.4-30.7v25.1c-2.8-.9-5.8-2.2-8.9-3.2 2.6-8.5 5.4-16.7 8.9-21.9z',
  'M60 46.8V76c0 2-1 2.2-2 2.2h-.8v1.2H66v-1.9c1.7 2.3 3.8 2.4 4.5 2.4 7.3 0 12-8.1 12-17.4 0-9-4-16.5-10.9-16.5-2.7 0-4.5 1.3-5.7 3.1v-4c0-5.8 1-12.5 3.1-18.3 9.6.2 20 2.6 31 2.6 19.9 0 24.9-8.9 24.9-16.4 0-7.2-7.7-13-20.3-13-17.2 0-30.7 8.5-38.2 21-1 1.7-1.9 3.5-2.7 5.3C39 27.8 18.9 44.9 18.9 69.9c0 15.8 8.8 28.7 21 36.6 0 .4-.1.6-.1 1 0 13.2 15.1 20.2 26.4 20.2 10.2 0 21.7-4.5 21.7-14.5 0-.7-.1-1.4-.2-2 3.7-2.2 6.3-5.3 6.3-9.6 0-10.2-13.5-14.3-24.8-14.3C55.7 87.3 41 93.5 40 106c-11.9-7.8-20.3-20.5-20.3-35.9 0-25.9 20.6-41.5 44-43.3-2.5 6.2-3.7 13.3-3.7 20zm10.8-24c6-12.5 17.4-22 33.3-22 8.5 0 18.4 2.7 18.4 12.9 0 11.9-12.2 15-22 15-12.2 0-21.3-2.4-31.2-2.6.5-1.2 1-2.3 1.5-3.3zm-10.6 81.7.5.3c2.7-2.2 8.1-3 10.9-3 5.6 0 14.2 3 15.5 9.1-5.1 2.9-12.4 3.9-17.9 3.9-10 0-20-3-28.4-8.3.2-12.9 15.9-18.8 28.6-18.8 10.5 0 23.7 4 23.7 13.9 0 4-2.2 6.9-5.5 8.9-1.7-6.3-9.8-9.3-16.1-9.3-6.6 0-11.3 3.3-11.3 3.3zm27 8c0 8.8-13 12.2-20.9 12.2-10.1 0-25.4-5.5-25.6-17.7 8.5 5.3 18.5 8.3 28.4 8.3 5.8 0 12.8-1 17.9-3.7.1.2.2.5.2.9zM71 47.4c2.9 0 5.4 3.2 5.4 15 0 4-.4 15.8-6 15.8-2.6 0-3.9-2.1-4.4-4.7V55.2c0-3.5 1.3-7.8 5-7.8zM83 70v8.4c.8.4 4.1 1.4 7.5 1.4 4.7 0 9-3.8 9-9.1 0-8.9-12.2-12.5-12.2-19.3 0-1.9 1.4-4.3 4.2-4.3 4 0 5.1 4.8 5.3 7.8h1.5v-7.8c-1.9-.6-4.3-1.2-6.4-1.2-4.6 0-9.3 3.4-9.3 8.4 0 9.2 12.1 11.7 12.1 19.6 0 2.6-1.6 4.7-4.2 4.7-5.2 0-5.9-6.3-6-8.6H83zm18.4-30.4c0 2.5 1.7 4.2 3.9 4.2s3.9-1.7 3.9-4.2c0-1.9-1.7-3.9-3.9-3.9-2.1 0-3.9 2-3.9 3.9zm-1.5 6.8v1.2h.9c1 0 2.1.1 2.1 2.1v26.4c0 2-1 2.2-2 2.2h-.8v1.2h11.4v-1.2h-.7c-1.1 0-1.9-.6-1.9-2.2V46.4h-9zm27.6 0v1.2h.9c1.9 0 2 2.2 2 3.5v16.1L120 46.4h-8v1.2h.7c1.9 0 2.2 2.2 2.2 4.2v23.8c0 1.4-.3 2.6-2.2 2.6h-.4v1.2h7.2v-1.2h-.4c-1.9 0-2.3-1.2-2.3-2.6V54.1l13 25.3h2.6V51.1c0-1.4.1-3.5 1.9-3.5h.7v-1.2h-7.5zm18.2 1.6c8.6 0 10.8-2.5 10.8-5.4 0-2-1.6-3-3.2-3-.8 0-1.5.2-2 .7.9.6 1.4 1.5 1.4 2.5 0 3.1-3.2 3.9-6.6 3.9h-1.5v-7.8h-1.4c-1.1 3.2-2.8 5.6-5 7-.9.6-1.9.8-3 .9V48h3.2v24.3c0 5.3 3.2 7.4 7.3 7.4 2.5 0 4.3-1 6-3.6l-.9-.7c-.9 1.8-2.3 2.2-3 2.2-2.2 0-3.3-1.5-3.3-4.2V48h1.2z',
  'M115.1 69.3v1c.5 29.3 23.7 43 44.1 43 13.9 0 23.7-6.2 23.7-16.3 0-8.9-8.6-12.1-16.4-12.1-6.9 0-15.8 2.6-15.8 9.1 0 5.4 6.8 7.2 10.6 7.2 2.4 0 6.3-.8 6.3-1.9 0-.5-.4-.7-.6-.4-.1.1-1.9 1.8-5.8 1.8-4.8 0-8.9-2.7-8.9-6.7 0-5.5 7.9-8.5 14-8.5 5 0 15.8 1.7 15.8 11.4 0 11.7-15.3 13.9-22.9 13.9-21.2 0-43.4-12.4-43.4-41.2 0-25.9 20.7-41 44.1-42.6-2.4 6.2-3.7 13.3-3.7 20v29.2c0 2-1 2.2-2 2.2h-.6v1.2h10.9v-1.2h-.4c-1.2 0-1.9-.6-1.9-2.2v-24c.1-2.4 2.1-3.9 4.3-3.9 3.2 0 4.5 2.4 4.5 5.5v22.5c0 2-.9 2.2-1.9 2.2h-.8v1.2h11.2v-1.2h-.7c-1.2 0-1.8-.6-1.8-2.2V54.4c0-5.8-4-8.3-8.6-8.3-2.5 0-5.2 1.2-6.3 2.7v-3.7c0-5.9 1-12.5 3.1-18.4 9.7.3 19.7 2.7 30.7 2.7 19.9 0 25.3-8.9 25.3-16.4 0-7.2-7.7-13-20.3-13-17.2 0-30.7 8.5-38.2 21-1 1.7-1.9 3.5-2.6 5.3-24.9 1.6-45 18.1-45 43zM166 22.7c6-12.5 17.4-22 33.3-22 8.5 0 18.4 2.7 18.4 12.9 0 11.9-12.6 15-22.4 15-12.2 0-20.9-2.4-30.7-2.6.4-1.1.9-2.2 1.4-3.3zm24.6 57.1c4.5 0 8.6-3.1 8.6-7.8 0-1.8-1.2-3.5-3.2-3.5-2.4 0-3.6 1.4-3.6 3.1.2-.1.4-.1.6-.1 1.4 0 2 1.4 2 2.5 0 2.4-1.7 4.5-4.4 4.5-3.4 0-5.6-2.7-5.6-13.8V62h14.1c.6 0 .6-.6.6-1.1 0-6.3-2.7-15-9.6-15-7.1 0-11.3 8.4-11.3 17.2.1 8.6 4.6 16.7 11.8 16.7zm-.5-32.7c3.2 0 3.7 7.5 3.7 12.4 0 .6-.2.9-.8.9h-7.9c.5-9 2.5-13.3 5-13.3z',
]
const ABSINTHE_ROTATIONS = [0, 120, 240] as const
const ABSINTHE_FLASK_FILL_PATH =
  'M24 13c2.2-1.3 4.9-2 8-2s5.8.7 8 2v1c0 3.7-2.3 6.6-5.5 7.8V30h-5v-8.2C26.3 20.6 24 17.7 24 14z'

const fromSimpleIcon = (icon: { title: string; path: string; hex: string }): TIconDefinition => ({
  title: icon.title,
  path: icon.path,
  viewBox: SIMPLE_ICON_VIEWBOX,
  color: `#${icon.hex}`,
})

const TECHNOLOGY_ICONS: Record<Exclude<TTechnology, 'authjs' | 'uvicorn'>, TIconDefinition> = {
  absinthe: {
    title: 'Absinthe',
    path: ABSINTHE_PATHS.join(' '),
    viewBox: '0 0 64 64',
    color: '#ffffff',
  },
  elixir: {
    ...fromSimpleIcon(siElixir),
    outlineColor: '#ffffff',
    outlineWidth: 2.4,
  },
  fastapi: fromSimpleIcon(siFastapi),
  graphql: {
    ...fromSimpleIcon(siGraphql),
    color: '#ffffff',
    underlayPath: CIRCLE_UNDERLAY_PATH,
    underlayColor: `#${siGraphql.hex}`,
  },
  markitdown: {
    title: 'MarkItDown',
    path: MARKITDOWN_PATH,
    viewBox: '0 0 208 128',
    color: '#ffffff',
  },
  hono: {
    title: 'Hono',
    path: '',
    viewBox: '0 0 76 98',
    color: '#ff4b1f',
    assetUrl: honoLogoUrl,
  },
  nextjs: {
    ...fromSimpleIcon(siNextdotjs),
    underlayPath: CIRCLE_UNDERLAY_PATH,
  },
  nodejs: fromSimpleIcon(siNodedotjs),
  oauth: {
    ...fromSimpleIcon(siOpenid),
    title: 'OAuth',
  },
  phoenix: fromSimpleIcon(siPhoenixframework),
  postgresql: {
    title: 'PostgreSQL',
    path: '',
    viewBox: '0 0 432.071 445.383',
    color: '#336791',
    assetUrl: postgresqlLogoUrl,
  },
  python: {
    title: 'Python',
    path: '',
    viewBox: '0 0 109.11 110.65',
    color: '#3776ab',
    assetUrl: pythonLogoUrl,
  },
  react: fromSimpleIcon(siReact),
  tailwindcss: fromSimpleIcon(siTailwindcss),
  typescript: {
    ...fromSimpleIcon(siTypescript),
    underlayPath: SQUARE_UNDERLAY_PATH,
  },
}

const UVICORN_ICON = {
  title: 'Uvicorn',
  color: 'var(--service-monogram-foreground)',
}
const AUTHJS_ICON = {
  title: 'Auth.js',
  color: 'var(--service-monogram-foreground)',
  assetUrl: authjsLogoUrl,
}

export function ServiceStackMark({ name, monogram, technologies }: TProps) {
  if (!technologies) {
    return (
      <span className='service-stack-mark is-monogram' role='img' aria-label={`${name} service`}>
        <span className='service-stack-monogram' aria-hidden='true'>
          {monogram}
        </span>
      </span>
    )
  }

  const stackLabel = technologies
    .map((technology) =>
      technology === 'authjs'
        ? AUTHJS_ICON.title
        : technology === 'uvicorn'
          ? UVICORN_ICON.title
          : TECHNOLOGY_ICONS[technology].title,
    )
    .join(', ')

  return (
    <span className='service-stack-mark' role='img' aria-label={`${name} stack: ${stackLabel}`}>
      {technologies.map((technology) => {
        const icon =
          technology === 'authjs'
            ? AUTHJS_ICON
            : technology === 'uvicorn'
              ? UVICORN_ICON
              : TECHNOLOGY_ICONS[technology]

        return (
          <span
            className='service-stack-cell'
            data-technology={technology}
            key={technology}
            title={icon.title}
            style={{ color: icon.color }}
            aria-hidden='true'
          >
            {technology === 'authjs' ? (
              <img src={AUTHJS_ICON.assetUrl} alt='' />
            ) : technology === 'uvicorn' ? (
              <Server />
            ) : technology === 'absinthe' ? (
              <svg viewBox={TECHNOLOGY_ICONS.absinthe.viewBox}>
                <circle cx='32' cy='32' r='31.5' fill='#ffffff' />
                <circle cx='32' cy='32' r='28.75' fill='#4a4a4a' />
                {ABSINTHE_ROTATIONS.map((rotation) => (
                  <g key={rotation} transform={`rotate(${rotation} 32 32)`}>
                    <circle cx='32' cy='13' r='10' fill='#ffffff' />
                    <rect x='27' y='18' width='10' height='15' rx='1' fill='#ffffff' />
                    <rect x='24' y='31' width='16' height='5' rx='1' fill='#ffffff' />
                    <path d={ABSINTHE_FLASK_FILL_PATH} fill='#7ed321' />
                  </g>
                ))}
              </svg>
            ) : TECHNOLOGY_ICONS[technology].assetUrl ? (
              <img src={TECHNOLOGY_ICONS[technology].assetUrl} alt='' />
            ) : (
              <svg viewBox={TECHNOLOGY_ICONS[technology].viewBox}>
                {TECHNOLOGY_ICONS[technology].underlayPath ? (
                  <path
                    d={TECHNOLOGY_ICONS[technology].underlayPath}
                    fill={TECHNOLOGY_ICONS[technology].underlayColor ?? '#ffffff'}
                  />
                ) : null}
                {TECHNOLOGY_ICONS[technology].outlineColor ? (
                  <path
                    d={TECHNOLOGY_ICONS[technology].path}
                    fill={TECHNOLOGY_ICONS[technology].color}
                    stroke={TECHNOLOGY_ICONS[technology].outlineColor}
                    strokeWidth={TECHNOLOGY_ICONS[technology].outlineWidth}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                ) : null}
                <path d={TECHNOLOGY_ICONS[technology].path} />
              </svg>
            )}
          </span>
        )
      })}
    </span>
  )
}
