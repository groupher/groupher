import { WithMargin } from '~/widgets/Common'
import Input from '~/widgets/Input'

import styled, { css, theme } from '~/css'

export const Wrapper = styled.div`
  margin-right: 5px;
`
export const Note = styled.div`
  font-size: 12px;
  margin-top: 10px;
  margin-bottom: 5px;
`
export const Preview = styled.div`
  color: ${theme('article.digest')};
  font-size: 13px;
  word-wrap: break-word;
`
export const Slug = styled.span`
  color: ${theme('article.title')};
`
export const Inputer = styled(Input)`
  width: 100%;
  height: 32px;
`
export const Title = styled(WithMargin)`
  ${css.row('align-center')};
`
