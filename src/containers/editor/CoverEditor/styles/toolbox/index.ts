import type { TActive } from '~/spec'
import styled, { css, theme } from '~/css'

import UploadSVG from '~/icons/Upload'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br, shadow, fg, bg, fill } = useTwBelt()

  return {
    wrapper: cn(
      'align-both absolute bottom-0 w-[480px] h-16 pt-0.5 border rounded-md z-20',
      // 'group-smoky-0 trans-all-200',
      'trans-all-200',
      'backdrop-blur-2xl',
      br('divider'),
      shadow('md'),
      bg('card'),
    ),

    panel: cn('align-both gap-x-4 h-12 w-fit px-5', fg('text.digest')),

    settingBlock: cn(
      'align-both rounded size-8 border mt-px',
      `hover:${br('text.digest')}`,
      br('divider'),
      shadow('sm'),
      bg('card'),
    ),
    settingBlockActive: cn(br('text.digest'), shadow('md')),
    settingTitle: cn('text-xs scale-75 mt-0.5', fg('text.digest')),
    settingIcon: cn(
      'size-5 opacity-65 trans-all-100',
      'group-hover/block:opacity-100',
      fill('text.title'),
    ),
    optionItem: cn(
      'align-both size-6 text-sm rounded border trans-all-100',
      `hover:${br('text.digest')}`,
      br('divider'),
      fg('text.digest'),
      shadow('sm'),
    ),
    optionItemActive: cn('bold-sm', fg('text.title'), br('text.digest')),
    //
    desc: cn('text-xs', fg('text.digest')),
  }
}

export const UploadIcon = styled(UploadSVG)`
  ${css.size(50)};
  fill: ${theme('article.info')};
  margin-bottom: 15px;
  opacity: 0.3;
`
export const Title = styled.div`
  color: ${theme('article.digest')};
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 5px;
`
export const Desc = styled.div`
  color: ${theme('article.digest')};
  font-size: 12px;
  opacity: 0.8;
`
export const SettingBlock = styled.div<TActive>`
  ${css.size(29)};
  ${css.row('align-both')};
  border-radius: 2px;
  border: 1px solid;
  border-color: ${({ $active }) => ($active ? theme('article.digest') : theme('divider'))};
  margin-top: 3px;
  margin-bottom: 7px;
  background: white;

  box-shadow: ${css.cardShadow};
  transition: all 0.3s;

  &:hover {
    border-color: ${theme('article.digest')};
  }
`
export const SettingTitle = styled.div<TActive>`
  color: ${({ $active }) => ($active ? theme('article.title') : theme('article.digest'))};
  font-size: 9px;
  opacity: 0.8;

  transition: color 0.2s;
`
