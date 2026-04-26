import { render, screen } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'

import YesOrNoButtons from './YesOrNoButtons'

describe('<YesOrNoButtons />', () => {
  it('shows LavaLampLoading and hides cancel text while loading', () => {
    render(<YesOrNoButtons loading cancelText='Cancel' saveText='Save' />, {
      wrapper: makeStoreWrapper(),
    })

    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    expect(document.querySelector('[aria-busy]')).not.toBeNull()
  })
})
