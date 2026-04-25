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
  mutation ($provider: OauthProviderInput!, $oauthTrustCode: String!) {
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
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
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
          raw: JSON.stringify(profile),
        }

        const params = {
          provider: standProvider,
          oauthTrustCode: process.env.OAUTH_TRUST_CODE,
        }

        try {
          const { data, error } = await oauthSignin(params)
          if (error) {
            // TODO: error handling on UI
            console.error('oauthSignin GraphQL error:', error)
          } else if (data?.signinOauth) {
            token[AUTH_KEY.TOKEN] = data.signinOauth.token
          }
        } catch (e) {
          console.error('oauthSignin request failed:', e)
        }
      }

      return token
    },
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)
