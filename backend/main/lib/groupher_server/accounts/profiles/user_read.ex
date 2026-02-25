defmodule GroupherServer.Accounts.Profiles.UserRead do
  @moduledoc false

  alias GroupherServer.{Accounts, Repo, Statistics}

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
    changeset = user |> Ecto.Changeset.change(attrs)

    changeset
    |> update_social_ifneed(user, attrs)
    |> User.update_changeset(attrs)
    |> Repo.update()
  end

  defp assign_meta_ifneed(%User{meta: nil} = user) do
    {:ok, Map.merge(user, %{meta: @default_user_meta})}
  end

  defp assign_meta_ifneed(user) do
    {:ok, user}
  end

  defp update_social_ifneed(changeset, %User{} = user, %{social: attrs}) do
    case ORM.find_by(Social, user_id: user.id) do
      {:ok, _} ->
        ORM.update_by(Social, [user_id: user.id], attrs)
        Ecto.Changeset.put_change(changeset, :social, nil)

      {:error, _} ->
        ORM.create(Social, attrs)
        changeset
    end
  end

  defp update_social_ifneed(changeset, _user, _attrs), do: changeset

  defp assign_default_contributes(%User{} = user) do
    {:ok, contributes} = Statistics.list_contributes_digest(%User{id: user.id})
    ORM.update_embed(user, :contributes, contributes)
  end
end
