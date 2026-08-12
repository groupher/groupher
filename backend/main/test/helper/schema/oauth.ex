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

end
