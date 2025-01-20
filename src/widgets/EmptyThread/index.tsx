/*
 *
 * EmptyThread
 *
 */

import type { FC } from 'react'

import type { TThread } from '~/spec'

type TProps = {
  thread: TThread
}

const EmptyThread: FC<TProps> = ({ thread }) => (
  <div>
    <h3>Empty Thread</h3>
  </div>
)

export default EmptyThread
