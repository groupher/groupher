import type { FC } from 'react'
import 'rsuite-table/dist/css/rsuite-table.css'

import { DSB_ROUTE } from '~/const/route'

import useTabInfo from '../logic/useTab'
import useSalon from '../salon/cms'
import Changelogs from './Changelogs'
import Communities from './Communities'
import Docs from './Docs'
import Posts from './Posts'

import '../salon/cms/global.css'

const CMS: FC = () => {
  const s = useSalon()

  let contents = null
  const { curTab: route } = useTabInfo()

  switch (route) {
    case DSB_ROUTE.COMMUNITIES: {
      contents = <Communities />
      break
    }
    case DSB_ROUTE.POST: {
      contents = <Posts />
      break
    }
    case DSB_ROUTE.CHANGELOG: {
      contents = <Changelogs />
      break
    }
    case DSB_ROUTE.DOC: {
      contents = <Docs />
      break
    }
    default:
      contents = <div>no such route</div>
      break
  }

  return <div className={s.wrapper}>{contents}</div>
}

export default CMS
