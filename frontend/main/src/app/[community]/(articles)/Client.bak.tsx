'use client'

import { collapseAllNested, defaultStyles, JsonView } from 'react-json-view-lite'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard.domain'
import Button from '~/widgets/Buttons/Button'
import 'react-json-view-lite/dist/index.css'

import useSalon from './salon'

export default () => {
  const s = useSalon()

  const { title, meta, commit } = useCommunity()

  const dashboard = useDashboard()

  return (
    <div className={s.wrapper}>
      <h1>community client for {title}</h1>
      <div>meta: {JSON.stringify(meta)}</div>

      <br />
      <Button
        onClick={() => {
          console.log('## commit')
          commit({ title: 'new title from client' })
        }}
      >
        change title
      </Button>
      <br />
      <Button
        onClick={() => {
          console.log('## dashboard commit')
          dashboard.commit({ avatarLayout: 'circle' })
        }}
      >
        change avatar layout
      </Button>

      <Button
        onClick={() => {
          console.log('## dashboard commit')
          dashboard.commit({ twSite: 'hello' })
        }}
      >
        change twSite
      </Button>
      <br />

      <div className='w-96'>
        dashboard:
        {JSON.stringify(dashboard.avatarLayout)}
        <JsonView
          data={dashboard}
          clickToExpandNode
          shouldExpandNode={collapseAllNested}
          style={defaultStyles}
        />
      </div>
    </div>
  )
}
