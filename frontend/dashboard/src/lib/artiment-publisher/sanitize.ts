import sanitizeHtml from 'sanitize-html'

const transformHeading: sanitizeHtml.Transformer = (tagName, attributes) => {
  const blockId = attributes['data-block-id']?.trim()

  return {
    tagName,
    attribs: {
      ...attributes,
      ...(blockId && !attributes.id ? { id: blockId } : {}),
    },
  }
}

const transformLink: sanitizeHtml.Transformer = (tagName, attributes) => ({
  tagName,
  attribs: {
    ...attributes,
    ...(attributes.target === '_blank' ? { rel: 'noopener noreferrer' } : {}),
  },
})

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    'a',
    'blockquote',
    'br',
    'code',
    'del',
    'details',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'input',
    'kbd',
    'li',
    'mark',
    'ol',
    'p',
    's',
    'span',
    'strike',
    'strong',
    'sub',
    'summary',
    'sup',
    'u',
    'ul',
  ],
  allowedAttributes: {
    '*': ['class'],
    a: ['href', 'rel', 'target'],
    details: ['open'],
    h1: ['data-block-id', 'id'],
    h2: ['data-block-id', 'id'],
    h3: ['data-block-id', 'id'],
    h4: ['data-block-id', 'id'],
    h5: ['data-block-id', 'id'],
    h6: ['data-block-id', 'id'],
    input: ['checked', 'disabled', 'type'],
    li: ['value'],
    ol: ['start'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: true,
  nestingLimit: 64,
  parseStyleAttributes: false,
  transformTags: {
    a: transformLink,
    h1: transformHeading,
    h2: transformHeading,
    h3: transformHeading,
    h4: transformHeading,
    h5: transformHeading,
    h6: transformHeading,
  },
}

/** Removes unsafe markup from rich-editor HTML before it enters a BodyBag. */
export const sanitizeArtimentHtml = (html: string): string => sanitizeHtml(html, options)
