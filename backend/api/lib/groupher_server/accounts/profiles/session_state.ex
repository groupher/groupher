defmodule GroupherServer.Accounts.Profiles.SessionState do
  @moduledoc """
  Owns authenticated account-session bootstrap and its stable read model.

      authenticated User
        -> idempotent default Community subscription bootstrap
        -> session state

  The default subscription is an explicit account-initialization effect, not a
  resolver-owned query side effect.
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User

  @doc "Bootstraps account defaults and returns the authenticated session state."
  @spec bootstrap(User.t()) :: {:ok, map()} | {:error, term()}
  def bootstrap(%User{} = user) do
    # A deployment may intentionally omit the default Community. Session
    # validity is authoritative; the idempotent bootstrap remains best effort.
    _ = CMS.Communities.subscribe_default_ifnot(user)

    {:ok,
     %{
       delegation_subject: Accounts.Profiles.delegation_subject(user),
       is_valid: true,
       user: user
     }}
  end
end
