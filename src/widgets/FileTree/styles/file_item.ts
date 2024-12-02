import type { TActive, TColor } from '~/spec'
import Img from '~/Img'
// import HashTagSVG from '~/icons/HashTag'
import styled, { css, theme, rainbow } from '~/css'

import { TagsWrapper } from '.'

type TTag = TActive & { color?: string }

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column relative p-1 max-w-36 pl-0'),
  }
}

export const Wrapper = styled.div<TTag>`
  position: relative;
  /* margin-left: 20px; */
  ${css.column()};
  padding: 4px;
  max-width: 180px;
  padding-left: 0;

  &:hover {
    cursor: pointer;
  }
`
export const AllTagIcon = styled(Img)`
  fill: ${theme('article.digest')};
  margin-right: 10px;
  ${css.size(14)};
  transform: rotate(17deg);
`
export const File = styled.div<TTag>`
  ${css.row('align-end', 'justify-between')};
  width: 100%;
  font-size: 14px;
  padding-left: 5px;
  padding-top: ${({ $active }) => ($active ? '2px' : 0)};
  padding-bottom: ${({ $active }) => ($active ? '2px' : 0)};

  ${Wrapper}:hover & {
    cursor: pointer;
  }

  transition: all 0.1s;
`
type TTitle = TActive & TColor
export const Title = styled.div<TTitle>`
  color: ${({ $active, $color }) => ($active ? rainbow($color) : theme('tags.text'))};
  font-weight: ${({ $active }) => ($active ? 500 : 400)};
  ${css.lineClamp(2)};

  ${Wrapper}:hover & {
    font-weight: 500;
    color: ${({ $color }) => rainbow($color)};
  }
`
export const RawWrapper = styled.div<TActive>`
  ${css.row('align-center')};
  opacity: ${({ $active }) => ($active ? 1 : 0)};

  ${Wrapper}:hover & {
    cursor: pointer;
    opacity: 1;
  }
  transition: all 0.1s;
`
export const Raw = styled.div`
  color: ${theme('tags.text')};
  font-size: 12px;
  margin-top: 1px;
  opacity: 0.8;
`
export const CountInfoWrapper = styled.div`
  opacity: 0;

  ${TagsWrapper}:hover & {
    opacity: 1;
  }

  transition: opacity 0.3s;
  transition-delay: 0.5s;
`

export const IndexDot = styled.div<TColor>`
  position: absolute;
  left: -12px;
  top: 14px;
  background-color: ${theme('hint')};
  background-color: ${({ $color }) => rainbow($color)};
  ${css.circle(5)};
  opacity: 0.65;
`
