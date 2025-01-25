import type { FC } from 'react'
import 'rsuite-table/dist/css/rsuite-table.css'

import { DASHBOARD_ROUTE } from '~/const/route'

import useTabInfo from '../logic/useTab'
import useSalon from '../salon/cms'

import Posts from './Posts'
import Communities from './Communities'
import Changelogs from './Changelogs'
import Docs from './Docs'

import '../salon/cms/global.css'

const CMS: FC = () => {
  const s = useSalon()

  let contents = null
  const { curTab: route } = useTabInfo()

  switch (route) {
    case DASHBOARD_ROUTE.COMMUNITIES: {
      contents = <Communities />
      break
    }
    case DASHBOARD_ROUTE.POST: {
      contents = <Posts />
      break
    }
    case DASHBOARD_ROUTE.CHANGELOG: {
      contents = <Changelogs />
      break
    }
    case DASHBOARD_ROUTE.DOC: {
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
