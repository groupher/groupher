import type { NextAuthConfig } from 'next-auth'
import { cookies /* headers */ } from 'next/headers'
import NextAuth from 'next-auth'

import OAUTH from '~/const/oauth'

import { GRAPHQL_ENDPOINT } from '~/config'
import { cacheExchange, createClient, fetchExchange, gql } from '@urql/core'
import { registerUrql } from '@urql/next/rsc'

import Github from 'next-auth/providers/github'
// import Google from 'next-auth/providers/google'

const makeClient = () => {
  return createClient({
    url: GRAPHQL_ENDPOINT,
    exchanges: [cacheExchange, fetchExchange],
  })
}

const { getClient } = registerUrql(makeClient)

// oauthTrustCode: fWrFuWs1j+TGcrok7XHkwDLiOVTGOnUR3JWF3cbcu2Tcnbj7TvSS1mMVeekvjgNQ
const signinOauthQuery = gql`
  mutation($provider: OauthProviderInput!, $oauthTrustCode: String!) {
    signinOauth(provider: $provider, oauthTrustCode: $oauthTrustCode) {
      token
      user {
        login
        avatar
        nickname
      }
    }
  }
`

const oauthSignin = (params) => {
  return getClient().mutation(signinOauthQuery, params)
}

export const config = {
  providers: [Github],
  // 配置回调函数
  callbacks: {
    async signIn({ account, profile }) {
      // finally get cookies and headers
      // https://github.com/nextauthjs/next-auth/discussions/4428#discussioncomment-7255005
      // const cookiesRes = cookies()
      // const headersRes = headers()

      // console.log('## ## cookiesRes: ', cookiesRes)
      // console.log('## ## headersRes: ', headersRes)

      // console.log('## ## ### ### ## ## ## ##')
      // console.log('## ## signIn callback user: ', user)
      // console.log('## ## signIn account: ', account)
      // console.log('## ## signIn profile: ', profile)

      console.log('## ## ### ### ## ## ## ##')

      // const [result, signinOauth] =  useMutation(signinOauthQuery)

      const standProvider = {
        provider: account.provider,
        provider_id: account.providerAccountId,
        login: profile.login,
        nickname: profile.name,
        avatar: profile.avatar_url,
        bio: profile.bio,
        country: '',
        city: profile.location,
        company: profile.company,
      }

      console.log('## ## standProvider: ', standProvider)

      const params = {
        provider: standProvider,
        oauthTrustCode: 'fWrFuWs1j+TGcrok7XHkwDLiOVTGOnUR3JWF3cbcu2Tcnbj7TvSS1mMVeekvjgNQ',
      }

      // const { data, error } = await getClient().mutation(signinOauthQuery, params)
      const { data, error } = await oauthSignin(params)

      if (error) return false
      console.log('## ## got server response: ', data)

      cookies().set({
        name: OAUTH.USER_KEY,
        value: JSON.stringify(data.signinOauth.user),
        path: '/',
      })

      cookies().set({
        name: OAUTH.TOKEN_KEY,
        value: data.signinOauth.token,
        path: '/',
      })

      // 返回 true 允许用户登录，返回 false 则拒绝登录
      return true
    },
    // ...其他回调
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)
