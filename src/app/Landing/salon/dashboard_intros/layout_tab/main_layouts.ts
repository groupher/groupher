import styled, { css, theme } from '~/css'
import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('column-align-both mt-8'),
    title: cn('text-xs', fg('text.digest')),
    layouts: 'row-center gap-x-4 mb-3',
    card: cn('relative w-28 h-28 rounded-md border', rainbow(color, 'borderSoft')),
    cardInactive: 'saturate-0 opacity-45',
    bar: cn('absolute h-1.5 w-8 rounded-md opacity-30', rainbow(color, 'bg')),
  }
}

export const Wrapper = styled.div`
  ${css.column('align-both')};
  margin-top: 30px;
`
export const Title = styled.div`
  font-size: 13px;
  color: ${theme('article.digest')};
  opacity: 0.7;
`
export const Layouts = styled.div`
  ${css.row('align-center')};
  flex-wrap: wrap;
  gap: 15px 20px;
  margin-bottom: 12px;
`
export const Card = styled.div`
  position: relative;
  width: 108px;
  height: 120px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid;
  border-radius: 8px;
  border-color: ${theme('divider')};
`
