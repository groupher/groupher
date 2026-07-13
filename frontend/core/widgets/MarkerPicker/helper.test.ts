import { describe, expect, it } from 'vitest'

import {
  COLOR,
  getDefaultCustomColor,
  RAINBOW_COLOR_HEX,
  RAINBOW_SOFT_COLOR_HEX,
} from '~/const/colors'
import { MARKER } from '~/const/marker'
import THEME from '~/const/theme'
import type { TMarkerAppearance, TMarkerValue } from '~/spec'

import { APPEARANCE_CHANNEL, CHECK_COLOR, MARKER_POPOVER_SURFACE_COLOR } from './constant'
import {
  getAppearanceTriggerStyle,
  getPresetHex,
  getReadableCheckColor,
  isCustomAppearanceValue,
  resolveActiveAppearance,
  toBgAppearance,
  updateMarkerAppearance,
} from './helper'

const ICON_MARKER: TMarkerValue = {
  type: MARKER.ICON,
  provider: 'lucide',
  name: 'external-link',
  src: '/icons/lucide/external-link.svg',
}

describe('MarkerPicker appearance helpers', () => {
  it('updates only the selected theme and channel', () => {
    const marker = updateMarkerAppearance(
      ICON_MARKER,
      THEME.LIGHT,
      APPEARANCE_CHANNEL.COLOR,
      '#112233',
    )

    expect(marker.appearance).toEqual({
      light: { color: '#112233' },
      dark: {},
    })
  })

  it('keeps only background appearance for emoji markers', () => {
    const appearance: TMarkerAppearance = {
      light: { color: '#112233', bg: '#eeeeee' },
      dark: { color: '#ffffff', bg: '#222222' },
    }

    expect(toBgAppearance(appearance)).toEqual({
      light: { bg: '#eeeeee' },
      dark: { bg: '#222222' },
    })

    const emoji = updateMarkerAppearance(
      { type: MARKER.EMOJI, unified: '1f44d' },
      THEME.DARK,
      APPEARANCE_CHANNEL.BG,
      '#334455',
    )

    expect(emoji.appearance).toEqual({ light: {}, dark: { bg: '#334455' } })
  })

  it('resolves soft presets independently for light and dark themes', () => {
    expect(getPresetHex(THEME.LIGHT, APPEARANCE_CHANNEL.BG, COLOR.BLUE)).toBe(
      RAINBOW_SOFT_COLOR_HEX[THEME.LIGHT][COLOR.BLUE],
    )
    expect(getPresetHex(THEME.DARK, APPEARANCE_CHANNEL.BG, COLOR.BLUE)).toBe(
      RAINBOW_SOFT_COLOR_HEX[THEME.DARK][COLOR.BLUE],
    )
  })

  it('detects custom values independently for each appearance channel', () => {
    expect(isCustomAppearanceValue('#123456', THEME.LIGHT, APPEARANCE_CHANNEL.COLOR)).toBe(true)
    expect(
      isCustomAppearanceValue(
        RAINBOW_SOFT_COLOR_HEX[THEME.LIGHT][COLOR.BLUE],
        THEME.LIGHT,
        APPEARANCE_CHANNEL.BG,
      ),
    ).toBe(false)
  })

  it('resolves the trigger color and background independently', () => {
    const presetColor = RAINBOW_COLOR_HEX[THEME.LIGHT][COLOR.BLUE]
    const presetBg = RAINBOW_SOFT_COLOR_HEX[THEME.LIGHT][COLOR.PURPLE]

    expect(
      getAppearanceTriggerStyle(
        {
          ...ICON_MARKER,
          appearance: {
            light: { color: presetColor, bg: presetBg },
            dark: {},
          },
        },
        THEME.LIGHT,
      ),
    ).toEqual({ color: presetColor, bg: presetBg })
    expect(getAppearanceTriggerStyle(ICON_MARKER, THEME.LIGHT)).toEqual({
      color: getDefaultCustomColor(THEME.LIGHT),
      bg: RAINBOW_SOFT_COLOR_HEX[THEME.LIGHT][COLOR.BLACK],
    })
    expect(
      getAppearanceTriggerStyle(
        {
          ...ICON_MARKER,
          appearance: {
            light: { color: '#123456', bg: '#fedcba' },
            dark: {},
          },
        },
        THEME.LIGHT,
      ),
    ).toEqual({ color: '#123456', bg: '#fedcba' })
    expect(
      getAppearanceTriggerStyle(
        {
          type: MARKER.EMOJI,
          unified: '1f44d',
          appearance: { light: { bg: presetBg }, dark: {} },
        },
        THEME.LIGHT,
      ),
    ).toEqual({ color: getDefaultCustomColor(THEME.LIGHT), bg: presetBg })
  })

  it('resolves explicit active presets before marker appearance', () => {
    const marker: TMarkerValue = {
      ...ICON_MARKER,
      appearance: {
        light: { color: '#112233', bg: '#445566' },
        dark: {},
      },
    }

    expect(
      resolveActiveAppearance({
        value: marker,
        theme: THEME.LIGHT,
        activeColor: COLOR.RED,
        activeBg: COLOR.BLUE,
      }),
    ).toEqual({
      color: RAINBOW_COLOR_HEX[THEME.LIGHT][COLOR.RED],
      bg: RAINBOW_SOFT_COLOR_HEX[THEME.LIGHT][COLOR.BLUE],
    })
  })

  it('resolves active color and background independently', () => {
    const marker: TMarkerValue = {
      ...ICON_MARKER,
      appearance: {
        light: { color: '#112233', bg: '#445566' },
        dark: {},
      },
    }

    expect(
      resolveActiveAppearance({
        value: marker,
        theme: THEME.LIGHT,
        activeColor: '#abcdef',
      }),
    ).toEqual({ color: '#abcdef', bg: '#445566' })
    expect(
      resolveActiveAppearance({
        value: marker,
        theme: THEME.LIGHT,
        activeBg: '#fedcba',
      }),
    ).toEqual({ color: '#112233', bg: '#fedcba' })
    expect(resolveActiveAppearance({ value: ICON_MARKER, theme: THEME.LIGHT })).toEqual({
      color: undefined,
      bg: undefined,
    })
  })

  it('chooses a readable black or white check color after alpha compositing', () => {
    expect(getReadableCheckColor('#ffffff', MARKER_POPOVER_SURFACE_COLOR.light)).toBe(
      CHECK_COLOR.BLACK,
    )
    expect(getReadableCheckColor('#000000', MARKER_POPOVER_SURFACE_COLOR.light)).toBe(
      CHECK_COLOR.WHITE,
    )
    expect(getReadableCheckColor('#f7d8fd38', MARKER_POPOVER_SURFACE_COLOR.dark)).toBe(
      CHECK_COLOR.WHITE,
    )
    expect(getReadableCheckColor('#f7d8fd38', MARKER_POPOVER_SURFACE_COLOR.light)).toBe(
      CHECK_COLOR.BLACK,
    )
  })
})
