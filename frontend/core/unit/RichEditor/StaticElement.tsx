import { SlateElement, type SlateElementProps } from 'platejs'

import useSalon, { cn } from './salon/static'

type TElement = SlateElementProps['element'] & {
  checked?: boolean
  href?: string
  icon?: string
  indent?: number
  listStyleType?: string
  type?: string
  url?: string
}

const INDENT_CLASS = ['ml-0', 'ml-4', 'ml-8', 'ml-12', 'ml-16'] as const

const getHref = (element: TElement): string => {
  const href = element.url || element.href
  if (!href) return '#'

  if (
    href.startsWith('/') ||
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('https://') ||
    href.startsWith('http://')
  ) {
    return href
  }

  return '#'
}

const getIndentClass = (indent?: number): string => {
  const level = Math.max(0, Math.min(indent || 0, INDENT_CLASS.length - 1))

  return INDENT_CLASS[level]
}

export default function StaticElement(props: SlateElementProps) {
  const s = useSalon()
  const element = props.element as TElement
  const type = element.type || 'p'

  if (element.listStyleType) {
    const isTodo = element.listStyleType === 'todo'

    return (
      <SlateElement {...props} as='div' className={cn(s.listLine, getIndentClass(element.indent))}>
        {isTodo ? (
          <span className={cn(s.todoBox, element.checked && s.todoBoxChecked)} />
        ) : (
          <span className={s.listMarker}>{element.listStyleType === 'decimal' ? '1.' : '•'}</span>
        )}
        <span className={s.listText}>{props.children}</span>
      </SlateElement>
    )
  }

  switch (type) {
    case 'a': {
      const href = getHref(element)
      const external = href.startsWith('http://') || href.startsWith('https://')

      return (
        <SlateElement
          {...props}
          as='a'
          className={s.link}
          attributes={{
            ...props.attributes,
            href,
            rel: external ? 'noreferrer' : undefined,
            target: external ? '_blank' : undefined,
          }}
        />
      )
    }

    case 'blockquote':
      return <SlateElement {...props} as='blockquote' className={s.blockquote} />

    case 'callout':
      return (
        <SlateElement {...props} as='aside' className={s.callout}>
          {!!element.icon && <span className='mr-2'>{element.icon}</span>}
          {props.children}
        </SlateElement>
      )

    case 'code_block':
      return <SlateElement {...props} as='pre' className={s.codeBlock} />

    case 'code_line':
      return <SlateElement {...props} as='code' className={s.codeLine} />

    case 'h1':
      return <SlateElement {...props} as='h1' className={s.heading1} />

    case 'h2':
      return <SlateElement {...props} as='h2' className={s.heading2} />

    case 'h3':
      return <SlateElement {...props} as='h3' className={s.heading3} />

    case 'h4':
      return <SlateElement {...props} as='h4' className={s.heading4} />

    case 'h5':
      return <SlateElement {...props} as='h5' className={s.heading5} />

    case 'h6':
      return <SlateElement {...props} as='h6' className={s.heading6} />

    case 'hr':
      return (
        <SlateElement {...props} as='div' className={s.hr}>
          <hr className={s.hrLine} />
          {props.children}
        </SlateElement>
      )

    case 'toggle':
      return (
        <SlateElement {...props} as='details' className={s.toggle} attributes={props.attributes}>
          <summary>{props.children}</summary>
        </SlateElement>
      )

    default:
      return <SlateElement {...props} as='p' className={s.paragraph} />
  }
}
