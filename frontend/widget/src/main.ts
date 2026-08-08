import {
  defineGroupherWidget,
  GROUPHER_WIDGET_TAG,
  GroupherWidgetElement,
} from './element/GroupherWidget'
import type { WidgetCommand, WidgetRuntime } from './loader/commandQueue'

const findWidget = (): GroupherWidgetElement | null =>
  document.querySelector<GroupherWidgetElement>(GROUPHER_WIDGET_TAG)

const mountWidget = (): GroupherWidgetElement => {
  const mounted = findWidget()
  if (mounted) return mounted

  const widget = document.createElement(GROUPHER_WIDGET_TAG) as GroupherWidgetElement
  document.body.append(widget)
  return widget
}

/**
 * Create the singleton DOM runtime used by the public command dispatcher.
 */
export const createWidgetRuntime = (): WidgetRuntime => {
  defineGroupherWidget()

  return {
    dispatch(command) {
      if (command.name === 'shutdown') {
        findWidget()?.dispose()
        return
      }

      if (command.name === 'boot') {
        mountWidget().boot(command.config)
        return
      }

      const widget = findWidget()
      if (!widget) return

      switch (command.name) {
        case 'open':
          widget.open(command.view)
          break
        case 'close':
          widget.close()
          break
        case 'toggle':
          widget.toggle()
          break
        case 'update':
          widget.updateContext(command.context)
          break
      }
    },
  }
}

window.__groupherWidgetCreateRuntime = createWidgetRuntime
