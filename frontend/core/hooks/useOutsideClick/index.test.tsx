import { fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'

import useOutsideClick from '~/hooks/useOutsideClick'

const SingleRefExample = ({ onOutside }: { onOutside: () => void }) => {
  const ref = useRef<HTMLDivElement | null>(null)
  useOutsideClick(ref, onOutside)

  return (
    <div>
      <div ref={ref}>inside</div>
      <button type='button'>outside</button>
    </div>
  )
}

const MultiRefExample = ({ onOutside }: { onOutside: () => void }) => {
  const aRef = useRef<HTMLDivElement | null>(null)
  const bRef = useRef<HTMLDivElement | null>(null)
  useOutsideClick([aRef, bRef], onOutside)

  return (
    <div>
      <div ref={aRef}>inside-a</div>
      <div ref={bRef}>inside-b</div>
      <button type='button'>outside</button>
    </div>
  )
}

describe('useOutsideClick', () => {
  it('calls callback only when clicking outside of a single ref', () => {
    const onOutside = vi.fn()
    render(<SingleRefExample onOutside={onOutside} />)

    fireEvent.click(screen.getByText('inside'))
    expect(onOutside).toHaveBeenCalledTimes(0)

    fireEvent.click(screen.getByText('outside'))
    expect(onOutside).toHaveBeenCalledTimes(1)
  })

  it('supports multiple refs', () => {
    const onOutside = vi.fn()
    render(<MultiRefExample onOutside={onOutside} />)

    fireEvent.click(screen.getByText('inside-a'))
    fireEvent.click(screen.getByText('inside-b'))
    expect(onOutside).toHaveBeenCalledTimes(0)

    fireEvent.click(screen.getByText('outside'))
    expect(onOutside).toHaveBeenCalledTimes(1)
  })
})
