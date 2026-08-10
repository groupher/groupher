defmodule GroupherServer.Test.Helper.Schema.OAuth do
  @moduledoc "GraphQL documents used by oauth tests."

  def m(:signin_oauth) do
    """
    mutation($provider: OauthProviderInput!) {
          signinOauth(provider: $provider) {
            accessToken
            accessExpiresAt
            browserSessionRef
            sessionAbsoluteExpiresAt
          }
        }
    """
  end

  def m(:link_oauth) do
    """
    mutation($provider: OauthProviderInput!) {
          linkOauth(provider: $provider) {
            token
            user {
              login
            }
          }
        }
    """
  end

  def m(:unlink_oauth) do
    """
    mutation($provider: OauthProviderInput!) {
          unlinkOauth(provider: $provider) {
            login
          }
        }
    """
  end
end
