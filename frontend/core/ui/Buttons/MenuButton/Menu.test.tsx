import { render, waitFor } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'

import Menu from './Menu'

const OPTIONS = [{ key: 'wechat', title: 'WeChat', qrLink: 'https://example.com/group' }]

describe('Menu', () => {
  it('loads the QR code only while the menu is active', async () => {
    const wrapper = makeStoreWrapper()
    const { queryByTestId, rerender } = render(
      <Menu options={OPTIONS} extraOptions={[]} panelMinWidth='w-28' active={false} />,
      { wrapper },
    )

    expect(queryByTestId('menu-qr-code')).not.toBeInTheDocument()

    rerender(<Menu options={OPTIONS} extraOptions={[]} panelMinWidth='w-28' active />)

    await waitFor(() => expect(queryByTestId('menu-qr-code')).toBeInTheDocument())
  })
})
