import { useState, type FC, Fragment } from 'react'
import { keys, values } from 'ramda'

import type { TWallpaper, TWallpaperGradientDir } from '~/spec'
import { COVER_GRADIENT_WALLPAPER, GRADIENT_DIRECTION } from '~/const/wallpaper'
import { parseWallpaper } from '~/wallpaper'

import Tooltip from '~/widgets/Tooltip'

import useLogic from '../useLogic'
import {
  Wrapper,
  Block,
  Panel,
  Title,
  BgRow,
  DirRow,
  Divider,
  BgImage,
  Desc,
  ImageWrapper,
  ImageBlock,
  DirWrapper,
  DirArrowIcon,
} from '../styles/toolbox/background_block'

type TProps = {
  wallpapers: Record<string, TWallpaper>
  wallpaper: string
  direction: TWallpaperGradientDir
}

const BackgroundBlock: FC<TProps> = ({ wallpapers, wallpaper, direction }) => {
  const { wallpaperOnChange, gradientDirOnChange } = useLogic()

  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <Wrapper>
      <Tooltip
        content={
          <Fragment>
            {panelOpen && (
              <Panel>
                <Title>渐变背景色:</Title>
                <BgRow>
                  <ImageWrapper $active={wallpaper === ''}>
                    <ImageBlock background="" onClick={() => wallpaperOnChange('')} />
                  </ImageWrapper>

                  {keys(COVER_GRADIENT_WALLPAPER).map((themeName) => (
                    <ImageWrapper key={themeName} $active={wallpaper === themeName}>
                      <ImageBlock
                        background={parseWallpaper(wallpapers, themeName).background}
                        onClick={() => wallpaperOnChange(themeName)}
                      />
                    </ImageWrapper>
                  ))}
                </BgRow>
                <Divider />
                <Title>渐变方向:</Title>
                <DirRow>
                  {values(GRADIENT_DIRECTION).map((dir) => (
                    <DirWrapper
                      key={dir}
                      $active={dir === direction}
                      onClick={() => gradientDirOnChange(dir)}
                    >
                      <DirArrowIcon dir={dir} />
                    </DirWrapper>
                  ))}
                </DirRow>
              </Panel>
            )}
          </Fragment>
        }
        placement="top-end"
        trigger="mouseenter focus"
        onShow={() => setPanelOpen(true)}
        onHide={() => setPanelOpen(false)}
        hideOnClick={false}
        offset={[26, 5]}
        noPadding
      >
        <Block $active={panelOpen}>
          <BgImage background={parseWallpaper(wallpapers, wallpaper).background} />
        </Block>
      </Tooltip>

      <Desc $active={panelOpen}>背景</Desc>
    </Wrapper>
  )
}

export default BackgroundBlock
