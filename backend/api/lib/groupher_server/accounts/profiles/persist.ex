defmodule GroupherServer.Accounts.Profiles.Persist do
  @moduledoc """
  Owns profile row, social row and subscription projection persistence.

  Persist performs database primitives only; Commands own transaction scope and
  Effects owns cache/revalidation after commit.

      profile command -> Persist -> User / Social / mailbox fields
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.{Social, User}
  alias Accounts.Profiles.ErrorCat
  alias CMS.Model.CommunitySubscriber
  alias Helper.ORM

  @doc """
  Updates editable user and social profile fields in the caller transaction.

  ## Examples

      Accounts.Profiles.Persist.update_profile(user, %{nickname: "Alice"})
  """
  @spec update_profile(User.t(), map()) :: {:ok, User.t()} | {:error, term()}
  def update_profile(%User{} = user, attrs) do
    if Map.has_key?(attrs, :login) or Map.has_key?(attrs, "login") do
      {:error, :immutable_login}
    else
      user_attrs = Map.drop(attrs, [:social])
      changeset = Ecto.Changeset.change(user, user_attrs)

      with {:ok, changeset} <- update_social_if_needed(changeset, user, attrs) do
        changeset |> User.update_changeset(user_attrs) |> Repo.update()
      end
    end
  end

  @doc """
  Rebuilds the denormalized subscribed-community fields for one user.

  ## Examples

      Accounts.Profiles.Persist.rebuild_subscribe_state(user)
  """
  @spec rebuild_subscribe_state(User.t()) :: {:ok, User.t()} | {:error, term()}
  def rebuild_subscribe_state(%User{} = user) do
    canonical_user =
      User
      |> where([candidate], candidate.id == ^user.id)
      |> lock("FOR UPDATE")
      |> Repo.one()

    case canonical_user do
      %User{} = locked_user ->
        query =
          from(s in CommunitySubscriber,
            where: s.user_id == ^locked_user.id,
            join: c in assoc(s, :community),
            select: c.id
          )

        subscribed_communities_ids = Repo.all(query)

        with {:ok, updated_user} <-
               ORM.update(locked_user, %{
                 subscribed_communities_count: length(subscribed_communities_ids)
               }) do
          ORM.update_meta(updated_user, %{
            subscribed_communities_ids: subscribed_communities_ids
          })
        end

      nil ->
        {:error, ErrorCat.not_exist("User")}
    end
  end

  defp update_social_if_needed(changeset, %User{} = user, %{social: attrs}) when is_map(attrs) do
    attrs = Map.put(attrs, :user_id, user.id)
    replace_fields = attrs |> Map.keys() |> Enum.reject(&(&1 == :user_id))

    result =
      %Social{}
      |> Social.changeset(attrs)
      |> Repo.insert(
        on_conflict: {:replace, replace_fields},
        conflict_target: :user_id,
        returning: true
      )

    case result do
      {:ok, _social} -> {:ok, changeset}
      {:error, reason} -> {:error, reason}
    end
  end

  defp update_social_if_needed(changeset, _user, _attrs), do: {:ok, changeset}
end
