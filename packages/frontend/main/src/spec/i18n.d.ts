import type langJson from '~/i18n/en'

export type TLocale = 'en' | 'zh' | 'zh-hant' | 'ru' | 'es'

// type TlangJson = typeof langJson

export type TTransKey = keyof typeof langJson
