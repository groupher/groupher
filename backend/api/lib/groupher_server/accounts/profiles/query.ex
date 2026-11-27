defmodule GroupherServer.Accounts.Profiles.Query do
  @moduledoc """
  Reads and shapes public profile projections and profile lists.

      User row / persisted contribution projection
          -> Profiles.Query
          -> public profile projection
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.{Embeds, OauthProvider, User}
  alias Accounts.Profiles.List
  alias Helper.{Datetime, ORM}

  @default_user_meta Embeds.UserMeta.default_meta()

  @doc """
  Shapes a user into the public profile projection without changing the source row.

  ## Examples

      Accounts.Profiles.Query.profile(user)
  """
  @spec profile(User.t()) :: {:ok, User.t()} | {:error, term()}
  def profile(%User{} = user) do
    with {:ok, user} <- assign_meta(user) do
      assign_contributes(user)
    end
  end

  @doc """
  Adds viewer-aware follow state to a public profile projection.

  ## Examples

      Accounts.Profiles.Query.profile(user, viewer)
  """
  @spec profile(User.t(), User.t()) :: {:ok, User.t()} | {:error, term()}
  def profile(%User{} = user, %User{meta: nil}), do: profile(user)

  def profile(%User{} = user, %User{} = viewer) do
    with {:ok, user} <- profile(user) do
      {:ok,
       Map.merge(user, %{
         viewer_been_followed: user.id in viewer.meta.follower_user_ids,
         viewer_has_followed: user.id in viewer.meta.following_user_ids
       })}
    end
  end

  @doc """
  Pages user identities with an explicit Pagi position.

  ## Examples

      Accounts.Profiles.Query.paged_users(%{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  defdelegate paged_users(filter, pagi), to: List

  @doc """
  Pages user identities with the requesting viewer's follow state.

  ## Examples

      Accounts.Profiles.Query.paged_users(%{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}, viewer)
  """
  defdelegate paged_users(filter, pagi, viewer), to: List

  @doc """
  Returns a bounded set of default Community suggestions.

  ## Examples

      Accounts.Profiles.Query.default_community_suggestions()
  """
  defdelegate default_community_suggestions(), to: List

  @doc """
  Pages Communities subscribed to by the supplied account.

  ## Examples

      Accounts.Profiles.Query.subscribed_communities(user, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  defdelegate subscribed_communities(user, filter, pagi), to: List

  @doc """
  Returns the canonical linked OAuth-account projection for an active user.

  ## Examples

      Accounts.Profiles.Query.linked_oauth_accounts("alice")
  """
  @spec linked_oauth_accounts(String.t()) :: {:ok, map()} | {:error, term()}
  def linked_oauth_accounts(login) do
    with {:ok, user} <- ORM.find_by(User, login: login) do
      bindings =
        OauthProvider
        |> where([binding], binding.user_id == ^user.id)
        |> order_by([binding], asc: binding.inserted_at, asc: binding.id)
        |> Repo.all()

      {:ok,
       %{
         entries:
           Enum.map(bindings, fn binding ->
             %{
               public_ref: binding.public_ref,
               provider: binding.provider,
               login: binding.login,
               nickname: binding.nickname,
               avatar: binding.avatar,
               can_unlink:
                 Enum.any?(bindings, fn other ->
                   other.id != binding.id and
                     Accounts.Profiles.OauthProviders.allow_sign_in?(other.provider)
                 end),
               linked_at: binding.inserted_at
             }
           end)
       }}
    end
  end

  defp assign_meta(%User{meta: nil} = user), do: {:ok, Map.put(user, :meta, @default_user_meta)}
  defp assign_meta(%User{} = user), do: {:ok, user}

  defp assign_contributes(%User{contributes: nil} = user) do
    end_date = Datetime.today()

    projection = %Embeds.UserContribute{
      start_date: Datetime.shift(end_date, months: -6),
      end_date: end_date,
      total_count: 0,
      records: []
    }

    {:ok, Map.put(user, :contributes, projection)}
  end

  defp assign_contributes(%User{} = user), do: {:ok, user}
end
