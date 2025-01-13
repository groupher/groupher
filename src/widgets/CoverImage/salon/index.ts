import Img from '~/Img'
import styled, { css } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('w-full h-72 mb-5'),
    imageWrapper: 'max-h-72 overflow-hidden',
    image: 'w-full max-h-72 rounded object-cover',
  }
}

export const Image = styled(Img)`
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  border-radius: 10px;

  ${css.media.mobile`
    border-radius: 4px;

  `};
`
