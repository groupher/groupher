defmodule GroupherServer.Accounts.Profiles.OauthProviders do
  @moduledoc """
  Resolves platform admission state for account operations.

      Phoenix configuration -> provider admission -> login, registration and link
  """

  @defaults %{"github" => :open, "linuxdo" => :open, "e2e" => :open}
  @internal ["e2e"]

  def state(provider) do
    Application.get_env(:groupher_server, :oauth_provider_states, @defaults)
    |> Map.get(provider, :closed)
  end

  def allow_sign_in?(provider), do: state(provider) in [:open, :existing]
  def allow_new_identity?(provider), do: state(provider) == :open

  def public_list do
    Application.get_env(:groupher_server, :oauth_provider_states, @defaults)
    |> Enum.reject(fn {provider, state} -> provider in @internal or state == :closed end)
    |> Enum.map(fn {provider, state} -> %{provider: provider, state: Atom.to_string(state)} end)
    |> Enum.sort_by(& &1.provider)
  end
end
