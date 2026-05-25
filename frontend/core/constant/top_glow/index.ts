import type { TTopGlowEffect } from '~/lib/topGlow/spec'

export const TOP_GLOW = {
  ORANGE_PURPLE: 'ORANGE_PURPLE',
  GREY_BROWN: 'GREY_BROWN',
  YELLOW_RED: 'YELLOW_RED',
  GREY_GREEN: 'GREY_GREEN',
  PURPLE_BLUE: 'PURPLE_BLUE',
  PASTEL_RAINBOW: 'PASTEL_RAINBOW',
  CENTER_ROSE: 'CENTER_ROSE',
  CENTER_EMERALD: 'CENTER_EMERALD',
  CENTER_VIOLET: 'CENTER_VIOLET',
  CENTER_AMBER: 'CENTER_AMBER',
  CENTER_CYAN: 'CENTER_CYAN',
  CENTER_MAGENTA: 'CENTER_MAGENTA',
  CENTER_ORANGE: 'CENTER_ORANGE',
  CENTER_SLATE: 'CENTER_SLATE',
} as const

export const TOP_GLOW_KEYS = [
  TOP_GLOW.ORANGE_PURPLE,
  TOP_GLOW.GREY_BROWN,
  TOP_GLOW.YELLOW_RED,
  TOP_GLOW.GREY_GREEN,
  TOP_GLOW.PURPLE_BLUE,
  TOP_GLOW.PASTEL_RAINBOW,
  TOP_GLOW.CENTER_ROSE,
  TOP_GLOW.CENTER_EMERALD,
  TOP_GLOW.CENTER_VIOLET,
  TOP_GLOW.CENTER_AMBER,
  TOP_GLOW.CENTER_CYAN,
  TOP_GLOW.CENTER_MAGENTA,
  TOP_GLOW.CENTER_ORANGE,
  TOP_GLOW.CENTER_SLATE,
] as const

export type TTopGlowName = (typeof TOP_GLOW_KEYS)[number]

const PREVIEW_LEFT = { x: '18%', y: '8%', radius: '62%' }
const PREVIEW_MAIN = { x: '72%', y: '8%', radius: '68%' }
const PREVIEW_RIGHT = { x: '94%', y: '20%', radius: '52%' }
const PREVIEW_CENTER = { x: '50%', y: '10%', radius: '76%' }

export const TOP_GLOW_LIGHT = {
  ORANGE_PURPLE: {
    layers: [
      {
        type: 'radial',
        color: '#f39e8d26',
        x: '25%',
        y: '-16%',
        radius: '30%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#ffeba824', x: '100%', y: '0', radius: '40%', preview: false },
      {
        type: 'radial',
        color: '#4e4bd212',
        x: '78%',
        y: '4%',
        radius: '40%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#961fb314',
        x: '90%',
        y: '15%',
        radius: '30%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  GREY_BROWN: {
    layers: [
      {
        type: 'radial',
        color: '#e7dcd08a',
        x: '20%',
        y: '-16%',
        radius: '30%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#d4003f03', x: '100%', y: '0', radius: '40%', preview: false },
      {
        type: 'radial',
        color: '#ff980012',
        x: '72%',
        y: '4%',
        radius: '40%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#f6c49f1c',
        x: '80%',
        y: '18%',
        radius: '30%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  YELLOW_RED: {
    layers: [
      {
        type: 'radial',
        color: '#ffc43b2b',
        x: '20%',
        y: '-16%',
        radius: '30%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#d4003f03', x: '100%', y: '0', radius: '40%', preview: false },
      {
        type: 'radial',
        color: '#f4433621',
        x: '78%',
        y: '4%',
        radius: '40%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#ff98000a',
        x: '90%',
        y: '15%',
        radius: '30%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  GREY_GREEN: {
    layers: [
      {
        type: 'radial',
        color: '#f3f0dfe3',
        x: '30%',
        y: '-16%',
        radius: '30%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#e9ede000', x: '100%', y: '0', radius: '40%', preview: false },
      {
        type: 'radial',
        color: '#e9ede0a6',
        x: '78%',
        y: '4%',
        radius: '40%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#fefdf629',
        x: '90%',
        y: '15%',
        radius: '30%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  PURPLE_BLUE: {
    layers: [
      {
        type: 'radial',
        color: '#e2eaf58f',
        x: '28%',
        y: '-8%',
        radius: '26%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#91dfe900', x: '100%', y: '0', radius: '40%', preview: false },
      {
        type: 'radial',
        color: '#d5e9fb59',
        x: '70%',
        y: '4%',
        radius: '35%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#d5e9fb70',
        x: '85%',
        y: '15%',
        radius: '30%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  PASTEL_RAINBOW: {
    layers: [
      {
        type: 'radial',
        color: '#b7f4f24f',
        x: '6%',
        y: '-10%',
        radius: '42%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#fff0c64a', x: '50%', y: '-8%', radius: '44%', preview: false },
      {
        type: 'radial',
        color: '#ffd4d94f',
        x: '88%',
        y: '-8%',
        radius: '42%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#eff3d73d',
        x: '72%',
        y: '16%',
        radius: '45%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  CENTER_ROSE: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#f9a8d44d',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_EMERALD: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#86efac45',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_VIOLET: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#c4b5fd52',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_AMBER: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#fde68a52',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_CYAN: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#67e8f94a',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_MAGENTA: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#f0abfc4d',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_ORANGE: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#fdba7452',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_SLATE: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#cbd5e152',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
} satisfies Record<TTopGlowName, TTopGlowEffect>

export const TOP_GLOW_DARK = {
  ORANGE_PURPLE: TOP_GLOW_LIGHT.ORANGE_PURPLE,
  GREY_BROWN: {
    layers: [
      {
        type: 'radial',
        color: '#5f564c8a',
        x: '20%',
        y: '-16%',
        radius: '30%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#d4003f03', x: '100%', y: '0', radius: '40%', preview: false },
      {
        type: 'radial',
        color: '#ff980012',
        x: '72%',
        y: '4%',
        radius: '40%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#f6c49f1c',
        x: '80%',
        y: '18%',
        radius: '30%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  YELLOW_RED: TOP_GLOW_LIGHT.YELLOW_RED,
  GREY_GREEN: {
    layers: [
      {
        type: 'radial',
        color: '#444b428a',
        x: '30%',
        y: '-16%',
        radius: '30%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#30381fa6', x: '100%', y: '0', radius: '40%', preview: false },
      {
        type: 'radial',
        color: '#2e3323a6',
        x: '78%',
        y: '4%',
        radius: '40%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#363c2978',
        x: '90%',
        y: '15%',
        radius: '30%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  PURPLE_BLUE: {
    layers: [
      {
        type: 'radial',
        color: '#323d498f',
        x: '28%',
        y: '-8%',
        radius: '26%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#2b36489e', x: '100%', y: '0', radius: '40%', preview: false },
      {
        type: 'radial',
        color: '#12283c59',
        x: '70%',
        y: '4%',
        radius: '35%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#0e2b4670',
        x: '85%',
        y: '15%',
        radius: '30%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  PASTEL_RAINBOW: {
    layers: [
      {
        type: 'radial',
        color: '#25d7d84d',
        x: '8%',
        y: '-10%',
        radius: '38%',
        preview: PREVIEW_LEFT,
      },
      { type: 'radial', color: '#e6ae5248', x: '48%', y: '-10%', radius: '40%', preview: false },
      {
        type: 'radial',
        color: '#ff5f7a4d',
        x: '88%',
        y: '-8%',
        radius: '40%',
        preview: PREVIEW_MAIN,
      },
      {
        type: 'radial',
        color: '#8f5cff3d',
        x: '72%',
        y: '10%',
        radius: '42%',
        preview: PREVIEW_RIGHT,
      },
    ],
  },
  CENTER_ROSE: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#7f1d3a78',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_EMERALD: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#064e3b78',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_VIOLET: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#4c1d9578',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_AMBER: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#78350f78',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_CYAN: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#164e6378',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_MAGENTA: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#83184378',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_ORANGE: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#7c2d1278',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
  CENTER_SLATE: {
    layers: [
      {
        type: 'radial',
        shape: 'ellipse',
        color: '#33415578',
        x: '50%',
        y: '-20%',
        radius: '36% 24%',
        preview: PREVIEW_CENTER,
      },
    ],
  },
} satisfies Record<TTopGlowName, TTopGlowEffect>
