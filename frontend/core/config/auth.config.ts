import { cacheExchange, createClient, fetchExchange, gql } from '@urql/core'
import { registerUrql } from '@urql/next/rsc'
import type { NextAuthConfig } from 'next-auth'
import NextAuth from 'next-auth'
import Github from 'next-auth/providers/github'
import { GRAPHQL_ENDPOINT } from '~/config'
import { AUTH_KEY } from '~/const/oauth'

// import Google from 'next-auth/providers/google'

const makeClient = () => {
  return createClient({
    url: GRAPHQL_ENDPOINT,
    exchanges: [cacheExchange, fetchExchange],
  })
}

const { getClient } = registerUrql(makeClient)

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
  secret: process.env.NEXTAUTH_SECRET,
  providers: [Github],
  // 配置回调函数
  callbacks: {
    async jwt({ token, account, profile }) {
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

      if (account && profile) {
        const params = {
          provider: standProvider,
          oauthTrustCode: process.env.OAUTH_TRUST_CODE,
        }

        const { data } = await oauthSignin(params)

        if (data?.signinOauth) {
          token[AUTH_KEY.TOKEN] = data.signinOauth.token
          token[AUTH_KEY.USER] = data.signinOauth.user
        }
      }
      return token
    },
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)
