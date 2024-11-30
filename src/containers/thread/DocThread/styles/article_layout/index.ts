import styled, { css, theme } from '~/css'

import ArrowSVG from '~/icons/ArrowSimple'
import ListSVG from '~/icons/List'

import useBase from '..'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  filterOpen: boolean
}

export default ({ filterOpen }: TProps) => {
  const { cn, fg, br } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn('row justify-center w-full relative'),
    header: 'mb-4',
    //
    content: cn(
      base.main,
      'grow text-base pl-12 pr-0 max-w-full',
      filterOpen ? 'w-[680px]' : 'px-20',
    ),
    //
    title: cn('text-2xl bold-sm', fg('text.title')),
    faq: 'ml-8 -mt-2.5',

    sidebar: cn(
      'column w-52 min-w-52 pt-8 border-r',
      br('divider'),
      filterOpen ? 'max-w-auto visiable' : 'min-w-0 max-w-0 w-0 hidden overflow-hidden',
    ),
  }
}

export const ToggleBtn = styled.div<{ open: boolean }>`
  position: absolute;
  top: 12%;
  left: ${({ open }) => (open ? '214px' : '20px')};
  transform: ${({ open }) => (open ? '' : 'rotate(180deg)')};

  ${({ open }) => (open ? css.circle(24) : css.circle(28))};
  ${css.row('align-both')};
  background: white;
  border: 1px solid;
  border-color: ${theme('divider')};
  z-index: 2;

  &:hover {
    box-shadow: ${css.cardShadow};
    /* border-color: ${theme('article.digest')}; */
    cursor: pointer;
  }
  /* transition: all 0.2s; */
`

export const ToggleArrowIcon = styled(ArrowSVG)`
  ${css.size(16)};
  fill: ${theme('article.digest')};

  ${ToggleBtn}:hover & {
    fill: ${theme('article.title')};
  }

  transition: all 0.2s;
`

export const ToggleListIcon = styled(ListSVG)`
  ${css.size(14)};
  fill: ${theme('article.digest')};
  opacity: 0.6;

  ${ToggleBtn}:hover & {
    fill: ${theme('article.title')};
    opacity: 1;
  }

  transition: all 0.2s;
`
