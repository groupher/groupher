import { timeout } from 'promise-timeout'

import { graphqlClient } from './client'
import { TIMEOUT_SEC } from './config'
import S from './schema'

export const searchUserPromise = (login) => timeout(graphqlClient.request(S.user, { login }), TIMEOUT_SEC)

export const ransformUser = ({ user }) => ({
  avatar: user.avatarUrl,
  nickname: user.login,
  githubId: user.id,
  bio: user.bio,
  location: user.location,
  company: user.company,
  htmlUrl: user.url,
})
