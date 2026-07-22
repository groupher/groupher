import { cacheExchange, createClient, fetchExchange, gql } from '@urql/core'
import { registerUrql } from '@urql/next/rsc'
import type { NextAuthConfig } from 'next-auth'
import NextAuth from 'next-auth'
import Github from 'next-auth/providers/github'

import { GRAPHQL_ENDPOINT } from '~/config'
import { AUTH_KEY } from '~/const/oauth'
import { GROUPHER_SERVER_TRUST_HEADER } from '~/const/serverTrust'

// import Google from 'next-auth/providers/google'

const makeClient = () => {
  return createClient({
    url: GRAPHQL_ENDPOINT,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()

      return serverTrustSecret
        ? { headers: { [GROUPHER_SERVER_TRUST_HEADER]: serverTrustSecret } }
        : {}
    },
  })
}

const { getClient } = registerUrql(makeClient)

const signinOauthQuery = gql`
  mutation ($provider: OauthProviderInput!) {
    signinOauth(provider: $provider) {
      token
      user {
        login
        avatar
        nickname
      }
    }
  }
`

const oauthSignin = (provider) => {
  return getClient().mutation(signinOauthQuery, { provider })
}

const config = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [Github],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const standProvider = {
          provider: account.provider,
          providerId: account.providerAccountId,
          login: profile.login,
          nickname: profile.name,
          avatar: profile.avatar_url,
          bio: profile.bio,
          country: '',
          city: profile.location,
          company: profile.company,
          raw: JSON.stringify(profile),
        }

        try {
          const { data, error } = await oauthSignin(standProvider)
          if (error) {
            console.error('oauthSignin GraphQL error:', {
              provider: standProvider,
              message: error.message,
            })
            throw new Error('oauthSignin GraphQL error')
          } else if (data?.signinOauth) {
            const backendToken = data.signinOauth.token

            if (typeof backendToken !== 'string' || backendToken.length === 0) {
              throw new Error('oauthSignin returned invalid token')
            }

            token[AUTH_KEY.TOKEN] = backendToken
          } else {
            throw new Error('oauthSignin returned empty token info')
          }
        } catch (e) {
          console.error('oauthSignin request failed:', {
            provider: standProvider,
            message: e instanceof Error ? e.message : 'unknown error',
          })
          throw e
        }
      }

      return token
    },
  },
} satisfies NextAuthConfig

export const { handlers } = NextAuth(config)
