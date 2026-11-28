defmodule GroupherServer.Accounts.Profiles.Oauth do
  @moduledoc """
  Stable internal Facade. Infrastructure access belongs to the delegated Owner.

      caller -> GroupherServer.Accounts.Profiles.Oauth -> result
  """

  @doc """
  Delegates find_oauth_provider/1 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.Profiles.Oauth.find_oauth_provider(...)
  """
  defdelegate find_oauth_provider(arg1), to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc """
  Delegates link_in_transaction/2 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.Profiles.Oauth.link_in_transaction(...)
  """
  defdelegate link_in_transaction(arg1, arg2), to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc """
  Delegates normalize_oauth_provider/1 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.Profiles.Oauth.normalize_oauth_provider(...)
  """
  defdelegate normalize_oauth_provider(arg1), to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc """
  Delegates recover_registration_race/2 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.Profiles.Oauth.recover_registration_race(...)
  """
  defdelegate recover_registration_race(arg1, arg2),
    to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc """
  Delegates registration_multi/1 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.Profiles.Oauth.registration_multi(...)
  """
  defdelegate registration_multi(arg1), to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc """
  Delegates register_in_transaction/1 to the owning implementation.

  ## Examples

      Accounts.Profiles.Oauth.register_in_transaction(provider_payload)
  """
  defdelegate register_in_transaction(arg1),
    to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc "Registers with a chosen Groupher login while preserving provider identity."
  defdelegate register_in_transaction(arg1, arg2),
    to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc """
  Delegates registration_result/1 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.Profiles.Oauth.registration_result(...)
  """
  defdelegate registration_result(arg1), to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc """
  Delegates unlink_identity_in_transaction/2 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.Profiles.Oauth.unlink_identity_in_transaction(...)
  """
  defdelegate unlink_identity_in_transaction(arg1, arg2),
    to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc """
  Delegates unlink_in_transaction/2 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.Profiles.Oauth.unlink_in_transaction(...)
  """
  defdelegate unlink_in_transaction(arg1, arg2),
    to: GroupherServer.Accounts.Profiles.Oauth.Workflow

  @doc """
  Delegates update_profile_social/2 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.Profiles.Oauth.update_profile_social(...)
  """
  defdelegate update_profile_social(arg1, arg2),
    to: GroupherServer.Accounts.Profiles.Oauth.Workflow
end
