import type { TActive, TColor } from '~/spec'
import styled, { css, theme, rainbow } from '~/css'
import CheckSVG from '~/icons/CheckBold'

export const Wrapper = styled.div`
  margin-right: 5px;
`
type TItem = TActive
export const Item = styled.div<TItem>`
  ${css.row('align-center')};
  width: calc(100% + 5px);
  padding: 6px 8px;
  padding-right: 4px;
  border-radius: 5px;
  margin-left: -4px;
  cursor: pointer;

  &:hover {
    background: ${theme('hoverBg')};
  }
`

export const Title = styled.div<TActive>`
  font-size: 14px;
  margin-left: 2px;
  color: ${({ $active }) => ($active ? theme('article.title') : theme('article.digest'))};
  flex-grow: 1;

  ${Item}:hover & {
    color: ${theme('article.title')};
  }

  transition: color 0.15s;
`
export const CheckIcon = styled(CheckSVG)<TColor>`
  ${css.size(15)};
  fill: ${({ $color }) => rainbow($color)};

  ${Item}:hover & {
    fill: ${({ $color }) => rainbow($color)};
  }
`
