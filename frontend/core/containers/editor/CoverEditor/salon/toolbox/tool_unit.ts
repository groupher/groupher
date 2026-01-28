import useBase from '.'

export { cn } from '~/css'

export default () => {
  const base = useBase()

  return {
    wrapper: 'column-align-both size-16 group/block',
    panel: base.panel,
    block: base.settingBlock,
    blockActive: base.settingBlockActive,
    title: base.settingTitle,
    icon: base.settingIcon,
  }
}
