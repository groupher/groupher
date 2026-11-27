defmodule GroupherServer.Test.Helper.Schema.OAuth do
  @moduledoc "GraphQL documents used by oauth tests."

  def m(:signin_oauth) do
    """
    mutation($provider: OauthProviderInput!) {
          signinOauth(provider: $provider, flowRef: "test-flow-ref") {
            status
            session { accessToken accessExpiresAt browserSessionRef sessionAbsoluteExpiresAt }
            registration { suggestedLogin }
          }
        }
    """
  end
end
