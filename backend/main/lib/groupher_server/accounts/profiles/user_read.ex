defmodule GroupherServer.Accounts.Profiles.UserRead do
  @moduledoc """
  Read/update boundary for profile detail pages.

  Reading a user increments views, fills lazy profile meta/contribution embeds
  when needed, and can add viewer follow-state fields. Profile updates also keep
  the optional social record and user page cache in sync.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> UserRead
        -> Repo
  """

  alias GroupherServer.{Accounts, Analysis, FrontDesk, Repo}

  alias Accounts.Model.{Embeds, Social, User}
  alias Helper.ORM

  @default_user_meta Embeds.UserMeta.default_meta()

  def read_user(%User{} = user) do
    with {:ok, user} <- ORM.inc(user, :views),
         {:ok, user} <- assign_meta_ifneed(user) do
      case user.contributes do
        nil -> assign_default_contributes(user)
        _ -> {:ok, user}
      end
    end
  end

  def read_user(%User{} = user, %User{meta: nil}), do: read_user(user)

  def read_user(%User{} = user, %User{} = cur_user) do
    with {:ok, user} <- read_user(user) do
      viewer_been_followed = user.id in cur_user.meta.follower_user_ids
      viewer_has_followed = user.id in cur_user.meta.following_user_ids

      user =
        Map.merge(user, %{
          viewer_been_followed: viewer_been_followed,
          viewer_has_followed: viewer_has_followed
        })

      {:ok, user}
    end
  end

  def update_profile(%User{} = user, attrs \\ %{}) do
    user_attrs = Map.drop(attrs, [:social])
    changeset = user |> Ecto.Changeset.change(user_attrs)

    changeset
    |> update_social_ifneed(user, attrs)
    |> User.update_changeset(user_attrs)
    |> Repo.update()
    |> revalidate_user()
    |> maybe_preload_social(attrs)
  end

  defp assign_meta_ifneed(%User{meta: nil} = user) do
    {:ok, Map.merge(user, %{meta: @default_user_meta})}
  end

  defp assign_meta_ifneed(user) do
    {:ok, user}
  end

  defp update_social_ifneed(changeset, %User{} = user, %{social: attrs}) when is_map(attrs) do
    attrs = Map.put(attrs, :user_id, user.id)

    case ORM.find_by(Social, user_id: user.id) do
      {:ok, _} ->
        ORM.update_by(Social, [user_id: user.id], attrs)
        changeset

      {:error, _} ->
        ORM.create(Social, attrs)
        changeset
    end
  end

  defp update_social_ifneed(changeset, _user, _attrs), do: changeset

  defp assign_default_contributes(%User{} = user) do
    {:ok, contributes} = Analysis.list_contributions_digest(%User{id: user.id})

    user
    |> ORM.update_embed(:contributes, contributes)
    |> revalidate_user()
  end

  defp revalidate_user({:ok, %User{login: login}} = response) when is_binary(login) do
    FrontDesk.revalidate().user(login)
    response
  end

  defp revalidate_user(response), do: response

  defp maybe_preload_social({:ok, %User{} = user}, %{social: _}) do
    {:ok, Repo.preload(user, :social, force: true)}
  end

  defp maybe_preload_social(response, _attrs), do: response
end
