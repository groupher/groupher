import { describe, expect, it } from 'vitest'

import { DEFAULT_PIN_MARKER, SIDE_TREE_NODE_TYPE } from '../constant'
import type { TDocTreeNodeDTO } from '../spec'
import { createSideTreePin } from './factory'
import { mapPin } from './mapper'
import { isLocalId } from './tree'

describe('docs side tree pins', () => {
  it('creates an editable local pin', () => {
    const pin = createSideTreePin('Untitled')

    expect(pin).toMatchObject({
      type: SIDE_TREE_NODE_TYPE.PIN,
      title: 'Untitled',
      href: '',
    })
    expect(pin.marker).toBe(DEFAULT_PIN_MARKER)
    expect(isLocalId(pin.id)).toBe(true)
  })

  it('maps a pin DTO into the SideTree pin shape', () => {
    const node: TDocTreeNodeDTO = {
      id: 'pin-github',
      type: 'PIN',
      title: 'GitHub',
      href: 'https://github.com/groupher/groupher',
      publishState: {
        published: true,
        hasUnpublishedChanges: false,
      },
    }

    expect(mapPin(node)).toEqual({
      id: 'pin-github',
      type: SIDE_TREE_NODE_TYPE.PIN,
      title: 'GitHub',
      href: 'https://github.com/groupher/groupher',
      marker: undefined,
      hidden: undefined,
      publishState: {
        published: true,
        hasUnpublishedChanges: false,
      },
    })
    expect(isLocalId(node.id)).toBe(false)
  })
})
