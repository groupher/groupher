import type { TTooltipPlacement } from '~/spec'

export const MENU = {
  DEFAULT: {
    key: 'DEFAULT',
    height: '40px',
  },
  PEOPLE: {
    key: 'PEOPLE',
    height: '240px',
  },
  I18N: {
    key: 'I18N',
    height: '260px',
  },
  NOTIFY: {
    key: 'NOTIFY',
    height: '120px',
  },
  SHARE: {
    key: 'SHARE',
    height: '240px',
  },
  MORE: {
    key: 'MORE',
    height: '192px',
  },
}

export const TIP_OPTIONS = {
  placement: 'top' as TTooltipPlacement,
  delay: 500,
  offset: [1, 8] as [number, number],
}
