import type { FC } from 'react'
import { range } from 'ramda'
import ContentLoader from 'react-content-loader'

import type { TSpace } from '~/spec'
import useTheme from '~/hooks/useTheme'

import useSalon from './salon/article_content_loading'

const LoadingItem = ({ theme }) => {
  return (
    <ContentLoader
      height={100}
      width={400}
      speed={2}
      foregroundColor={theme.divider}
      backgroundColor={theme.divider}
      backgroundOpacity={0.5}
    >
      <rect x="25" y="16.05" rx="5" ry="5" width="363" height="8" />
      <rect x="25" y="46.05" rx="5" ry="5" width="358.0" height="8" />
      <rect x="25" y="75" rx="5" ry="5" width="355" height="8" />
      <rect x="25" y="16.05" rx="5" ry="5" width="363" height="8" />
      <rect x="25" y="46.05" rx="5" ry="5" width="358.0" height="8" />
      <rect x="25" y="75" rx="5" ry="5" width="355" height="8" />
    </ContentLoader>
  )
}

type TProps = TSpace & { num?: number }

const ArticleContentLoading: FC<TProps> = ({ num = 1, ...spacing }) => {
  const s = useSalon({ ...spacing })
  const { themeMap } = useTheme()

  return (
    <div className={s.wrapper}>
      {range(0, num).map((item) => (
        <div className={s.inner} key={item}>
          <LoadingItem theme={themeMap} />
        </div>
      ))}
    </div>
  )
}

export default ArticleContentLoading
