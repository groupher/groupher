import GuardSVG from '~/icons/EnGuard'
import HuaSVG from '~/icons/Huaren'
import PandaSVG from '~/icons/Panda'
import RussiaSVG from '~/icons/Russia'
import SpainSVG from '~/icons/Spain'
import type { TSelectOption } from '~/spec'

export const LOCALE = {
  EN: 'en',
  ZH: 'zh',
  'ZH-HANT': 'zh-hant',
  RU: 'ru',
  ES: 'es',
} as const

export const LANGS_OPTIONS = [
  {
    label: 'English',
    value: LOCALE.EN,
    icon: GuardSVG,
  },
  {
    label: '简体中文',
    value: LOCALE.ZH,
    icon: PandaSVG,
  },
  {
    label: '繁体中文',
    value: LOCALE['ZH-HANT'],
    icon: HuaSVG,
  },
  {
    label: 'Русский',
    value: LOCALE.RU,
    icon: RussiaSVG,
  },
  {
    label: 'Español',
    value: LOCALE.ES,
    icon: SpainSVG,
  },
] as TSelectOption[]
