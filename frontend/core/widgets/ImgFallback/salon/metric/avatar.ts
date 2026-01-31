import SIZE from '~/const/size'
import type { TSizeSML } from '~/spec'

const FONT_BY_SIZE: Record<TSizeSML, string> = {
  [SIZE.SMALL]: 'text-xs',
  [SIZE.MEDIUM]: 'text-sm',
  [SIZE.LARGE]: 'text-base',
}

export const getFontSize = (size: TSizeSML): string => {
  return FONT_BY_SIZE[size]
}
