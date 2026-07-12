defmodule GroupherServer.Test.Helper.Schema.OAuth do
  @moduledoc "GraphQL documents used by oauth tests."

  def m(:signin_oauth) do
    """
    mutation($provider: OauthProviderInput!, $oauthTrustCode: String!) {
          signinOauth(provider: $provider, oauthTrustCode: $oauthTrustCode) {
            token
            user {
              login
            }
          }
        }
    """
  end

  def m(:link_oauth) do
    """
    mutation($provider: OauthProviderInput!, $oauthTrustCode: String!) {
          linkOauth(provider: $provider, oauthTrustCode: $oauthTrustCode) {
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
    mutation($provider: OauthProviderInput!, $oauthTrustCode: String!) {
          unlinkOauth(provider: $provider, oauthTrustCode: $oauthTrustCode) {
            login
          }
        }
    """
  end
end
