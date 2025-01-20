import { createGlobalStyle } from 'styled-components'

import { theme } from '~/css'
import type { TColor } from '~/spec'

import normalize from './normalize'

const GlobalStyle = createGlobalStyle<TColor>`
  ${normalize};
  html {
    background-color: ${theme('htmlBg')};
    -webkit-font-smoothing: antialiased;
  }
  body {
    margin: 0;
    overflow-x: hidden;
  }


// mentions
  .markdown-editor-mention {
    color: ${theme('comment.mentionText')};
    background: ${theme('comment.mentionTextBg')};
    cursor: pointer;
    display: inline-block;
    padding-left: 4px;
    padding-right: 4px;
    margin-bottom: 4px;
    border-radius: 3px;
    text-decoration: none;
  }
  .markdown-editor-mention:hover,
  .markdown-editor-mention:focus {
    color: ${theme('comment.mentionText')};
    background: ${theme('comment.mentionTextBg')};
    outline: 0; /* reset for :focus */
  }

  .markdown-editor-suggestions {
    border: 1px solid;
    border-color: ${theme('comment.mentionBorder')};
    background: ${theme('comment.mentionBg')};
    margin-top: 10px;
    position: absolute;
    min-width: 160px;
    max-width: 300px;

    border-radius: 2px;
    cursor: pointer;
    z-index: 2;
    display: flex;
    -webkit-box-orient: vertical;
    -webkit-box-direction: normal;
    flex-direction: column;
    box-sizing: border-box;
    -webkit-transform: scale(0);
    transform: scale(0);
  }
  .markdown-editor-mentionSuggestionsEntry {
    transition: background-color 0.4s cubic-bezier(0.27, 1.27, 0.48, 0.56);
    padding: 7px 10px 3px 10px;
    padding-left: 10px;
    display: flex;
  }
  .markdown-editor-mentionSuggestionsEntry:active {
    background-color: ${theme('rainbow.red')};
  }
  .markdown-editor-mentionSuggestionsEntryFocused {
    padding: 7px 10px 3px 10px;
    display: flex;
  }

  .markdown-editor-mentionSuggestionsEntryText {
    display: inline-block;
    margin-left: 8px;

    max-width: 368px;
    font-size: 1rem;
    margin-bottom: 0.2em;
    color: ${theme('article.title')};
  }

  .markdown-editor-mentionSuggestionsEntryAvatar {
    display: inline-block;
    width: 24px;
    height: 24px;
    border-radius: 12px;
  }

  .markdown-editor-link {
    color: ${theme('link')};

    &:hover {
      color: ${theme('link')};
      text-decoration: underline;
    }
  }

  // masonry cards styles

  .masonry-cards-grid {
    display: flex;
    width: auto;
  }
  .masonry-cards-grid_column {
    background-clip: padding-box;
    padding: 8px;
  }

  .tippy-box {
    border: 1px solid;
    border-color: ${theme('popover.borderColor')};
    border-radius: 4px;
    background: ${theme('popover.bg')} !important;
    transition: all .2s ease-in-out !important;
  }

  /** wechat brower not support backdrop-filter well */
  @supports (-webkit-backdrop-filter:none) or (backdrop-filter:none) {
    .tippy-box {
      border: 1px solid;
      border-color: ${theme('popover.borderColor')};
      background: ${theme('popover.bg')} !important;
      border-radius: 4px;
      transition: all .2s ease-in-out !important;
    }
  }

  .tippy-box[data-placement^=top][data-state='visible'] {
    transform: translateY(-5px);
  }
  .tippy-box[data-placement^=bottom][data-state='visible'] {
    transform: translateY(5px);
  }
  .tippy-box[data-placement^=left][data-state='visible'] {
    transform: translateX(-5px);
  }
  .tippy-box[data-placement^=right][data-state='visible'] {
    transform: translateX(5px);
  }
  /* .tippy-box[data-state='hidden'] {
    opacity: 0;
  } */

  // 不然图片下面后有个条
  .lazy-load-image-background.blur.lazy-load-image-loaded {
    line-height: 0.8;
  }

  // toast
  [data-sonner-toast][data-styled=true] {
    padding: 7px 13px !important;
    width: 180px !important;
    margin-left: 100px;
    justify-content: center;
    color: ${theme('toast.title')} !important;
    background: ${theme('toast.bg')} !important;
    border-color: ${theme('toast.border')} !important;
  }
  [data-sonner-toast] [data-close-button] {
    background: ${theme('hoverBg')} !important;
    color: ${theme('hint')} !important;
    border-color: ${theme('hint')} !important;
  }
  [data-sonner-toast][data-mounted=true] {
    margin-top: -8px !important;
  }
`
export default GlobalStyle
