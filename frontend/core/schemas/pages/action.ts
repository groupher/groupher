export const reaction = `
  mutation($id: ID!, $action: String!, $thread: Thread!) {
    reaction(id: $id, action: $action, thread: $thread) {
      id
    }
  }
`
export const undoReaction = `
  mutation($id: ID!, $action: String!, $thread: Thread!) {
    undoReaction(id: $id, action: $action, thread: $thread) {
      id
    }
  }
`
export const setTag = `
  mutation($thread: Thread!, $id: ID!, $tagId: ID!, $communityId: ID!) {
    setTag(thread: $thread, id: $id, tagId: $tagId, communityId: $communityId) {
      id
      title
    }
  }
`
export const unsetTag = `
  mutation($thread: Thread!, $id: ID!, $tagId: ID!, $communityId: ID!) {
    unsetTag(
      thread: $thread
      id: $id
      tagId: $tagId
      communityId: $communityId
    ) {
      id
      title
    }
  }
`

export const follow = `
  mutation($login: String!) {
    follow(login: $login) {
      login
      viewerHasFollowed
    }
  }
`

export const undoFollow = `
  mutation($login: String!) {
    undoFollow(login: $login) {
      login
      viewerHasFollowed
    }
  }
`
