import type { TAvatarLayout } from '~/spec'
import styled, { css, theme } from '~/css'

import { AVATAR_LAYOUT } from '~/const/layout'

import Img from '~/Img'

export const Wrapper = styled.div`
  min-height: 300px;
  width: 230px;
  min-width: 180px;
  padding-top: 18px;
  margin-top: 75px;

  border-left: 1px solid transparent;
  border-image: linear-gradient(
    0.5turn,
    transparent,
    ${theme('divider')},
    ${theme('divider')},
    ${theme('divider')},
    transparent
  );

  border-image-slice: 1;
`
export const InnerWrapper = styled.div`
  width: 100%:
  height: auto;
  padding-left: 56px;

`
export const Label = styled.div`
  font-size: 13px;
  color: ${theme('article.title')};
  margin-bottom: 12px;
`
export const Count = styled.span`
  color: ${theme('article.digest')};
  font-weight: 400;
  font-size: 12px;
  margin-left: 3px;
  opacity: 0.8;
`
export const Value = styled.div`
  font-size: 13px;
  color: ${theme('article.digest')};
  margin-bottom: 5px;
`

export const TagsSection = styled.div`
  margin-bottom: 5px;
  width: 100%;
`

export const UserList = styled.div`
  ${css.columnWrap()};
  gap: 10px 0;
`

export const User = styled.div`
  ${css.row('align-center')};
`
export const Avatar = styled(Img)<{ $avatarLayout: TAvatarLayout }>`
  ${css.size(18)};
  border-radius: ${({ $avatarLayout }) => ($avatarLayout === AVATAR_LAYOUT.SQUARE ? '6px' : '100%')};
`
export const Nickname = styled.div`
  color: ${theme('article.digest')};
  font-size: 13px;
  margin-left: 8px;
`
