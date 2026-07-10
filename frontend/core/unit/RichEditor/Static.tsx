'use client'

import {
  BaseBlockquotePlugin,
  BaseBoldPlugin,
  BaseCodePlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseH4Plugin,
  BaseH5Plugin,
  BaseH6Plugin,
  BaseHighlightPlugin,
  BaseHorizontalRulePlugin,
  BaseItalicPlugin,
  BaseKbdPlugin,
  BaseStrikethroughPlugin,
  BaseSubscriptPlugin,
  BaseSuperscriptPlugin,
  BaseUnderlinePlugin,
} from '@platejs/basic-nodes'
import {
  BaseParagraphPlugin,
  createSlatePlugin,
  createStaticEditor,
  PlateStatic,
  type SlatePlugins,
  type Value,
} from 'platejs'
import type { FC } from 'react'
import { useMemo } from 'react'

import useSalon from './salon/static'
import StaticElement from './StaticElement'
import StaticLeaf from './StaticLeaf'

type TProps = {
  value: Value
}

const LinkPlugin = createSlatePlugin({
  key: 'a',
  node: {
    isElement: true,
    isInline: true,
  },
}).withComponent(StaticElement)

const CodeBlockPlugin = createSlatePlugin({
  key: 'code_block',
  node: {
    isElement: true,
  },
}).withComponent(StaticElement)

const CodeLinePlugin = createSlatePlugin({
  key: 'code_line',
  node: {
    isElement: true,
  },
}).withComponent(StaticElement)

const CalloutPlugin = createSlatePlugin({
  key: 'callout',
  node: {
    isElement: true,
  },
}).withComponent(StaticElement)

const TogglePlugin = createSlatePlugin({
  key: 'toggle',
  node: {
    isElement: true,
  },
}).withComponent(StaticElement)

const STATIC_PLUGINS: SlatePlugins = [
  BaseParagraphPlugin.withComponent(StaticElement),
  BaseBlockquotePlugin.withComponent(StaticElement),
  BaseHorizontalRulePlugin.withComponent(StaticElement),
  BaseH1Plugin.withComponent(StaticElement),
  BaseH2Plugin.withComponent(StaticElement),
  BaseH3Plugin.withComponent(StaticElement),
  BaseH4Plugin.withComponent(StaticElement),
  BaseH5Plugin.withComponent(StaticElement),
  BaseH6Plugin.withComponent(StaticElement),
  LinkPlugin,
  CodeBlockPlugin,
  CodeLinePlugin,
  CalloutPlugin,
  TogglePlugin,
  BaseBoldPlugin.withComponent(StaticLeaf),
  BaseItalicPlugin.withComponent(StaticLeaf),
  BaseUnderlinePlugin.withComponent(StaticLeaf),
  BaseStrikethroughPlugin.withComponent(StaticLeaf),
  BaseCodePlugin.withComponent(StaticLeaf),
  BaseKbdPlugin.withComponent(StaticLeaf),
  BaseHighlightPlugin.withComponent(StaticLeaf),
  BaseSubscriptPlugin.withComponent(StaticLeaf),
  BaseSuperscriptPlugin.withComponent(StaticLeaf),
]

const RichEditorStatic: FC<TProps> = ({ value }) => {
  const s = useSalon()
  const editor = useMemo(
    () =>
      createStaticEditor({
        plugins: STATIC_PLUGINS,
        value,
      }),
    [value],
  )

  return <PlateStatic editor={editor} value={value} className={s.wrapper} />
}

export default RichEditorStatic
