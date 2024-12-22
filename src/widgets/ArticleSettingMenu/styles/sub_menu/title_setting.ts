import Input from '~/widgets/Input'

import styled, { theme } from '~/css'

export const Wrapper = styled.div`
  margin-right: 5px;
`
export const Inputer = styled(Input)`
  width: 100%;
  height: 32px;
`
export const Note = styled.div`
  color: ${theme('hint')};
  font-size: 12px;
  margin-top: 10px;
  margin-bottom: 5px;
`
