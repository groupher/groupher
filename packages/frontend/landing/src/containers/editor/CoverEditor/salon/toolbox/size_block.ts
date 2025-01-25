import useBase from '.'

export { cn } from '~/css'

export default () => {
  const base = useBase()

  return {
    panel: base.panel,
    block: base.settingBlock,
    blockActive: base.settingBlockActive,
    icon: base.settingIcon,
    //
    optionItem: base.optionItem,
    optionItemActive: base.optionItemActive,
  }
}
