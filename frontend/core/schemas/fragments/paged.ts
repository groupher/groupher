import { article, author, pagi } from './base'

export const pagedPosts = `
  entries {
    ${article}
    cat
    status
    commentsParticipants {
      ${author}
    }
  }
  ${pagi}
`
export const holder = 1
