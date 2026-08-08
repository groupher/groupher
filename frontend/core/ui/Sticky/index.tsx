/*
 *
 * Sticky
 * this code is on github:
 * https://github.com/codecks-io/react-sticky-box/blob/master/src/index.js
 * copy here for reduce the final bundle size
 *
 */

import T from 'prop-types'
import React from 'react'
import ResizeObserver from 'resize-observer-polyfill'

import { Global } from '~/helper'

type TStickyBoxProps = {
  children: React.ReactNode
  onChangeMode?: (previousMode: string, newMode: string) => void
  offsetTop?: number
  offsetBottom?: number
  bottom?: boolean
  className?: string
}

type TStickyBoxState = {
  mode?: string
  offset?: number
  nodeHeight?: number
  parentHeight?: number
  viewPortHeight?: number
  scrollPaneOffset?: number
  naturalTop?: number
  latestScrollY?: number
}

class StickyBox extends React.Component<TStickyBoxProps, TStickyBoxState> {
  private node: HTMLElement | null = null
  private scrollPane: HTMLElement | Window | null = null
  private unsubscribes: Array<() => void> = []
  private mode: string | undefined
  private offset = 0
  private nodeHeight = 0
  private parentHeight = 0
  private viewPortHeight = 0
  private scrollPaneOffset = 0
  private naturalTop = 0
  private latestScrollY = 0

  static propTypes = {
    children: T.node.isRequired,
    onChangeMode: T.func,
    offsetTop: T.number,
    offsetBottom: T.number,
    bottom: T.bool,
    className: T.string,
  }

  static defaultProps = {
    onChangeMode: () => {
      /* TODO */
    },
    offsetTop: 0,
    offsetBottom: 0,
    bottom: false,
    className: '',
  }

  constructor(props: TStickyBoxProps) {
    super(props)
    this.state = {}
  }

  addListener = (
    element: HTMLElement | Window,
    event: string,
    handler: EventListenerOrEventListenerObject,
    passive?: boolean | AddEventListenerOptions,
  ) => {
    element.addEventListener(event, handler, passive)
    this.unsubscribes.push(() => element.removeEventListener(event, handler))
  }

  addResizeObserver = (node: HTMLElement, handler: ResizeObserverCallback) => {
    const ro = new ResizeObserver(handler)
    ro.observe(node)
    this.unsubscribes.push(() => ro.disconnect())
  }

  registerContainerRef = (n: HTMLElement | null) => {
    if (!stickyProp) return
    this.node = n
    if (n) {
      this.scrollPane = getScrollParent(this.node)
      this.latestScrollY =
        this.scrollPane === Global ? window.scrollY : (this.scrollPane as HTMLElement).scrollTop

      this.addListener(this.scrollPane, 'scroll', this.handleScroll, passiveArg)
      this.addListener(this.scrollPane, 'mousewheel', this.handleScroll, passiveArg)
      if (this.scrollPane === Global) {
        this.addListener(Global, 'resize', this.handleWindowResize)
        this.handleWindowResize()
      } else {
        this.addResizeObserver(this.scrollPane as HTMLElement, this.handleScrollPaneResize)
        this.handleScrollPaneResize()
      }
      this.addResizeObserver(this.node.parentNode as HTMLElement, this.handleParentNodeResize)
      this.handleParentNodeResize()

      this.addResizeObserver(this.node, this.handleNodeResize)

      // 手动调用一次 updateNodeHeight 来初始化节点高度
      const initialHeight = this.node.getBoundingClientRect().height
      this.updateNodeHeight(initialHeight)

      this.initial()
    } else {
      try {
        for (const fn of this.unsubscribes) {
          try {
            fn()
          } catch (err) {
            console.error(err)
          }
        }
      } finally {
        this.unsubscribes = []
        this.scrollPane = null
      }
    }
  }

  updateNodeHeight = (height: number) => {
    const prevHeight = this.nodeHeight
    this.nodeHeight = height

    if (height !== prevHeight) {
      const { offsetTop, offsetBottom, bottom } = this.props
      if (this.nodeHeight + offsetTop + offsetBottom <= this.viewPortHeight) {
        // Just make it sticky if node smaller than viewport
        this.mode = undefined
        this.initial()
      } else {
        const diff = prevHeight - this.nodeHeight
        const lowestPossible = this.parentHeight - this.nodeHeight
        const nextOffset = Math.min(lowestPossible, this.getCurrentOffset() + (bottom ? diff : 0))
        this.offset = Math.max(0, nextOffset)
        if (!bottom || this.mode !== 'stickyBottom') this.changeMode('relative')
      }
    }
  }

  handleNodeResize = (entries: ResizeObserverEntry[]) => {
    const height = entries[0].contentRect.height
    this.updateNodeHeight(height)
  }

  changeMode = (newMode: string) => {
    const { onChangeMode, offsetTop, offsetBottom, bottom } = this.props
    if (this.mode !== newMode) onChangeMode(this.mode, newMode)
    this.mode = newMode
    if (newMode === 'relative') {
      this.node.style.position = 'relative'
      if (bottom) {
        const nextBottom = Math.max(0, this.parentHeight - this.nodeHeight - this.offset)
        this.node.style.bottom = `${nextBottom}px`
      } else {
        this.node.style.top = `${this.offset}px`
      }
    } else {
      this.node.style.position = stickyProp
      if (newMode === 'stickyBottom') {
        if (bottom) {
          this.node.style.bottom = `${offsetBottom}px`
        } else {
          this.node.style.top = `${this.viewPortHeight - this.nodeHeight - offsetBottom}px`
        }
      } else {
        // stickyTop
        if (bottom) {
          this.node.style.bottom = `${this.viewPortHeight - this.nodeHeight - offsetBottom}px`
        } else {
          this.node.style.top = `${offsetTop}px`
        }
      }
    }
    this.offset = this.getCurrentOffset()
  }

  initial = () => {
    const { bottom } = this.props
    if (bottom) {
      if (this.mode !== 'stickyBottom') this.changeMode('stickyBottom')
    } else if (this.mode !== 'stickyTop') {
      this.changeMode('stickyTop')
    }
  }

  getCurrentOffset = () => {
    if (this.mode === 'relative') return this.offset
    const { offsetTop, offsetBottom } = this.props
    if (this.mode === 'stickyTop') {
      return Math.max(0, this.scrollPaneOffset + this.latestScrollY - this.naturalTop + offsetTop)
    }
    if (this.mode === 'stickyBottom') {
      return Math.max(
        0,
        this.scrollPaneOffset +
          this.latestScrollY +
          this.viewPortHeight -
          (this.naturalTop + this.nodeHeight + offsetBottom),
      )
    }
    return 0
  }

  changeToStickyBottomIfBoxTooLow = (scrollY: number) => {
    const { offsetBottom } = this.props
    if (
      scrollY + this.scrollPaneOffset + this.viewPortHeight >=
      this.naturalTop + this.nodeHeight + this.offset + offsetBottom
    ) {
      this.changeMode('stickyBottom')
    }
  }

  handleWindowResize = () => {
    this.viewPortHeight = window.innerHeight
    this.scrollPaneOffset = 0
    this.handleScroll()
  }

  handleScrollPaneResize = () => {
    this.viewPortHeight = (this.scrollPane as HTMLElement).offsetHeight
    if (process.env.NODE_ENV !== 'production' && this.viewPortHeight === 0) {
      console.log(
        'react-sticky-box scroll pane has a height of 0. This seems odd. Please check this node:',
        this.scrollPane,
      )
    }
    // Only applicable if scrollPane is an offsetParent
    if (
      (this.scrollPane as HTMLElement).firstChild instanceof HTMLElement &&
      // @ts-expect-error
      (this.scrollPane as HTMLElement).firstChild.offsetParent === this.scrollPane
    ) {
      this.scrollPaneOffset = (this.scrollPane as HTMLElement).getBoundingClientRect().top
    } else {
      this.scrollPaneOffset = 0
    }
    this.handleScroll()
  }

  handleParentNodeResize = () => {
    const parentNode = this.node?.parentNode as HTMLElement
    const computedParentStyle = getComputedStyle(parentNode, null)
    const parentPaddingTop = Number.parseInt(
      computedParentStyle.getPropertyValue('padding-top'),
      10,
    )
    const parentPaddingBottom = Number.parseInt(
      computedParentStyle.getPropertyValue('padding-bottom'),
      10,
    )
    const verticalParentPadding = parentPaddingTop + parentPaddingBottom
    this.naturalTop =
      offsetTill(parentNode, this.scrollPane as HTMLElement) +
      parentPaddingTop +
      this.scrollPaneOffset
    const oldParentHeight = this.parentHeight
    this.parentHeight = parentNode.getBoundingClientRect().height - verticalParentPadding

    if (this.mode === 'relative') {
      const { bottom } = this.props
      if (bottom) {
        this.changeMode('relative')
      } else if (oldParentHeight > this.parentHeight) {
        // If parent height decreased...
        this.changeToStickyBottomIfBoxTooLow(this.latestScrollY)
      }
    }
    if (oldParentHeight !== this.parentHeight && this.mode === 'relative') {
      this.latestScrollY = Number.POSITIVE_INFINITY
      this.handleScroll()
    }
  }

  handleScroll = () => {
    const { offsetTop, offsetBottom } = this.props
    const scrollY =
      this.scrollPane === Global ? window.scrollY : (this.scrollPane as HTMLElement).scrollTop
    if (scrollY === this.latestScrollY) return
    if (this.nodeHeight + offsetTop + offsetBottom <= this.viewPortHeight) {
      // Just make it sticky if node smaller than viewport
      this.initial()
      this.latestScrollY = scrollY
      return
    }
    const scrollDelta = scrollY - this.latestScrollY
    this.offset = this.getCurrentOffset()

    if (scrollDelta > 0) {
      if (this.mode === 'relative') {
        this.changeToStickyBottomIfBoxTooLow(scrollY)
      } else if (
        this.mode === 'stickyTop' &&
        scrollY + this.scrollPaneOffset + offsetTop > this.naturalTop
      ) {
        const boxBottomVisible =
          scrollY + this.scrollPaneOffset + this.viewPortHeight <=
          this.naturalTop + this.nodeHeight + this.offset + offsetBottom

        this.changeMode(boxBottomVisible ? 'relative' : 'stickyBottom')
      }
    } else {
      if (
        this.mode === 'relative' &&
        this.scrollPaneOffset + scrollY + offsetTop < this.naturalTop + this.offset
      ) {
        this.changeMode('stickyTop')
      } else if (
        this.mode === 'stickyBottom' &&
        this.scrollPaneOffset + scrollY + this.viewPortHeight <
          this.naturalTop + this.parentHeight + offsetBottom
      ) {
        const boxTopVisible =
          this.scrollPaneOffset + scrollY + offsetTop >= this.naturalTop + this.offset

        this.changeMode(boxTopVisible ? 'relative' : 'stickyTop')
      }
    }

    this.latestScrollY = scrollY
  }

  render() {
    const { children, className } = this.props
    return (
      <div className={className} ref={this.registerContainerRef}>
        {children}
      </div>
    )
  }
}

export default StickyBox

// Helper functions
const getScrollParent = (node: HTMLElement): HTMLElement | Window => {
  let parent = node
  while ((parent = parent.parentElement)) {
    const overflowYVal = getComputedStyle(parent, null).getPropertyValue('overflow-y')
    if (parent === document.body) return window
    if (overflowYVal === 'auto' || overflowYVal === 'scroll') return parent
  }
  return window
}

const offsetTill = (node: HTMLElement, target: HTMLElement | Window): number => {
  let current = node
  let offset = 0
  let resolvedTarget = target

  // If target is not an offsetParent itself, subtract its offsetTop and set correct target
  if (
    resolvedTarget instanceof HTMLElement &&
    resolvedTarget.firstChild instanceof HTMLElement &&
    resolvedTarget.firstChild.offsetParent !== resolvedTarget
  ) {
    offset += node.offsetTop - resolvedTarget.offsetTop
    resolvedTarget = node.offsetParent as HTMLElement
    offset += -node.offsetTop
  }

  do {
    offset += current.offsetTop
    current = current.offsetParent as HTMLElement
  } while (current && current !== resolvedTarget)

  return offset
}

let stickyProp: string | null = null
if (typeof CSS !== 'undefined' && CSS.supports) {
  if (CSS.supports('position', 'sticky')) stickyProp = 'sticky'
  else if (CSS.supports('position', '-webkit-sticky')) {
    stickyProp = '-webkit-sticky'
  }
}

// Inspired by https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md#feature-detection
let passiveArg: boolean | AddEventListenerOptions = false
try {
  const opts = Object.defineProperty({}, 'passive', {
    get() {
      passiveArg = { passive: true }
    },
  })
  if (Global?.addEventListener) {
    Global.addEventListener('testPassive', null, opts)
    Global.removeEventListener('testPassive', null, opts)
  }
} catch (e) {
  console.log(e)
}
