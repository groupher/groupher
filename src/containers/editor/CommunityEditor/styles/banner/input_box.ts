import styled, { theme } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('row-center relative mb-4'),
    input: 'w-96 h-10 rounded-2xl text-lg text-center placeholder:text-base',
  }
}

// @ts-ignore
export const InputBar = styled.input.attrs(() => ({
  spellCheck: 'false',
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
}))`
  text-align: center;
  caret-color: ${theme('article.title')};
  flex-grow: 1;
  height: 100%;
  width: auto;
  min-width: 420px;
  outline: none;
  color: ${theme('article.title')};
  font-size: 18px;
  max-height: none;
  background-color: ${theme('alphaBg2')};
  padding: 10px 18px;
  border-radius: 15px;
  transition: all 400ms ease;

  border: 1px solid;
  border-color: ${theme('editor.border')};
  &:hover {
    opacity: 1;
    border-color: ${theme('button.primary')};
  }

  &:focus {
    opacity: 1;
    border-color: ${theme('editor.borderActive')};
  }

  ::placeholder {
    color: ${theme('text.hint')};
  }
`
