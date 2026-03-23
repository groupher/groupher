import { range } from 'ramda'
import type { FC } from 'react'
import ContentLoader from 'react-content-loader'
import useTheme from '~/hooks/useTheme'
import type { TSpace } from '~/spec'

import useSalon from './salon/article_content_loading'

const LoadingItem = ({ color }) => {
  return (
    <ContentLoader
      height={100}
      width={400}
      speed={2}
      foregroundColor={color}
      backgroundColor={color}
      backgroundOpacity={0.5}
    >
      <rect x='25' y='16.05' rx='5' ry='5' width='363' height='8' />
      <rect x='25' y='46.05' rx='5' ry='5' width='358.0' height='8' />
      <rect x='25' y='75' rx='5' ry='5' width='355' height='8' />
      <rect x='25' y='16.05' rx='5' ry='5' width='363' height='8' />
      <rect x='25' y='46.05' rx='5' ry='5' width='358.0' height='8' />
      <rect x='25' y='75' rx='5' ry='5' width='355' height='8' />
    </ContentLoader>
  )
}

type TProps = TSpace & { num?: number }

const ArticleContentLoading: FC<TProps> = ({ num = 1, ...spacing }) => {
  const s = useSalon({ ...spacing })
  const { isLightTheme } = useTheme()
  // tmp solution for remove styled-component
  const color = isLightTheme ? '#EAE9E9' : '#3c3c3c'

  return (
    <div className={s.wrapper}>
      {range(0, num).map((item) => (
        <div className={s.inner} key={item}>
          <LoadingItem color={color} />
        </div>
      ))}
    </div>
  )
}

export default ArticleContentLoading
