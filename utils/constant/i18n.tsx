import type { TLocale, TSelectOption } from '~/spec'

import PandaSVG from '~/icons/Panda'
import HuaSVG from '~/icons/Huaren'
import GuardSVG from '~/icons/EnGuard'
import RussiaSVG from '~/icons/Russia'
import SpainSVG from '~/icons/Spain'

export const LOCALE = {
  EN: 'en',
  ZH: 'zh',
  'ZH-HANT': 'zh-hant',
  RU: 'ru',
  ES: 'es',
} as Record<Uppercase<TLocale>, TLocale>

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
