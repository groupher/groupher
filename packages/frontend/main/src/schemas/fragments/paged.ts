import { article, author, pagi } from './base'

export const pagedPosts = `
  entries {
    ${article}
    cat
    state
    commentsParticipants {
      ${author}
    }
  }
  ${pagi}
`
export const holder = 1
