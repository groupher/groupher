import styled from '~/css'
import type { TTestable } from '~/spec'

// import Img from '~/Img'

export const Wrapper = styled.div.attrs<TTestable>(({ $testid }) => ({
  'data-test-id': $testid,
}))<TTestable>``

export const Title = styled.div``
