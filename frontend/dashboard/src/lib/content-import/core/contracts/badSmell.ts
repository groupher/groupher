export type TBadSmell = {
  code: string
  level: 'error' | 'warning'
  message: string
  path?: string
  sourceRef?: string
}
