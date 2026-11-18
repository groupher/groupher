defmodule GroupherServer.CMS.Passport.Store do
  @moduledoc """
  Persists Passport facts inside the transaction owned by a domain command.

      command lock and actor admission -> Store -> versioned authorization row

  The caller must lock the target User and load the current row in that same
  transaction before calling these functions. This module does not authorize
  the acting user or change root status.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, CommunityAdmin, GlobalPassport}
  alias CMS.Passport.Scope.Community, as: CommunityScope
  alias GroupherServer.Accounts.Model.User
  alias CMS.Passport.Catalog

  @doc "Loads Global facts for an already authenticated actor."
  def load_global_scope(%User{id: user_id}) when is_integer(user_id) do
    case global_facts(user_id) do
      {:ok, global} -> {:ok, %CMS.Passport.Scope.Global{actor_id: user_id, global: global}}
      {:error, _reason} = error -> error
    end
  end

  def load_global_scope(_), do: {:error, :invalid_scope}

  @doc "Loads actor and owner facts from an already located Article with its Author preloaded."
  def load_article_scope(%User{id: user_id}, %CMS.Model.Article{
        id: id,
        author: %CMS.Model.Author{user_id: owner_id}
      })
      when is_integer(user_id) and is_binary(id) and is_integer(owner_id) do
    with {:ok, global} <- global_facts(user_id),
         {:ok, membership} <- article_facts(user_id, id) do
      {:ok,
       %CMS.Passport.Scope.Article{
         actor_id: user_id,
         article_id: id,
         owner_user_id: owner_id,
         global: global,
         membership: membership
       }}
    end
  end

  def load_article_scope(_, _), do: {:error, :invalid_scope}

  @doc "Reads only the current user's membership for one canonical Article."
  def article_facts(user_id, article_id) when is_integer(user_id) and is_binary(article_id) do
    case Repo.one(
           from(member in CMS.Model.ArticleCoAuthor,
             join: author in CMS.Model.Author,
             on: author.id == member.author_id,
             where: member.article_id == ^article_id and author.user_id == ^user_id,
             select: member
           )
         ) do
      nil ->
        {:ok, nil}

      member ->
        case Catalog.validate_permissions(:article, member.permissions) do
          {:ok, permissions} ->
            {:ok, %{member_id: member.id, revision: member.revision, permissions: permissions}}

          {:error, _reason} = error ->
            error
        end
    end
  end

  def article_facts(_, _), do: {:error, :invalid_scope}

  @doc "Reads the current Global Passport facts for a stable user identity."
  def global_facts(user_id) when is_integer(user_id) do
    case Repo.get_by(GlobalPassport, user_id: user_id) do
      nil ->
        {:ok, %{is_root: false, permissions: %{}}}

      %GlobalPassport{is_root: is_root, permissions: permissions} ->
        case Catalog.validate_permissions(:global, permissions) do
          {:ok, normalized} -> {:ok, %{is_root: is_root, permissions: normalized}}
          {:error, _reason} = error -> error
        end
    end
  end

  def global_facts(_), do: {:error, :invalid_user}

  @doc "Reads the current system-root fact for a stable user identity."
  def system_root?(user_id) do
    case global_facts(user_id) do
      {:ok, %{is_root: is_root}} -> {:ok, is_root}
      {:error, _reason} = error -> error
    end
  end

  @doc "Reads Community Passport facts scoped to one user and one Community."
  def community_facts(user_id, community_id)
      when is_integer(user_id) and is_integer(community_id) do
    case Repo.get_by(CommunityAdmin, user_id: user_id, community_id: community_id) do
      nil ->
        {:ok, %{member_id: nil, revision: nil, is_lord: false, permissions: %{}}}

      %CommunityAdmin{} = member ->
        case Catalog.validate_permissions(:community, member.permissions) do
          {:ok, normalized} ->
            {:ok,
             %{
               member_id: member.id,
               revision: member.revision,
               is_lord: member.is_lord,
               permissions: normalized
             }}

          {:error, _reason} = error ->
            error
        end
    end
  end

  def community_facts(_, _), do: {:error, :invalid_scope}

  @doc "Loads Passport facts for the already located Community and current actor."
  def load_community_scope(%User{id: user_id}, %Community{id: community_id})
      when is_integer(user_id) and is_integer(community_id) do
    with {:ok, global} <- global_facts(user_id),
         {:ok, community} <- community_facts(user_id, community_id) do
      {:ok,
       %CommunityScope{
         actor_id: user_id,
         community_id: community_id,
         global: global,
         community: community
       }}
    end
  end

  def load_community_scope(_, _), do: {:error, :invalid_scope}

  @doc "Checks an action using already loaded, actor-bound Community facts."
  def allowed_community?(actor, scope, action, thread \\ nil)

  def allowed_community?(
        %User{id: user_id},
        %CommunityScope{actor_id: user_id, global: global, community: community},
        action,
        thread
      )
      when is_integer(user_id) do
    with {:ok, %{scope: :community} = metadata} <- Catalog.get(action),
         {:ok, :pass} <- require_action_thread(metadata, thread),
         {:ok, requirements} <- Catalog.requirements(action, thread) do
      allowed =
        global.is_root or community.is_lord or
          (Map.get(community.permissions, action) == true and
             Enum.all?(requirements, &(Map.get(community.permissions, &1) == true)))

      {:ok, allowed}
    else
      {:ok, _metadata} -> {:error, :permission_scope_mismatch}
      {:error, _reason} = error -> error
    end
  end

  def allowed_community?(_, _, _, _), do: {:error, :invalid_scope}

  defp require_action_thread(%{requires_thread: requirements}, nil)
       when map_size(requirements) > 0,
       do: {:error, :thread_required}

  defp require_action_thread(_metadata, _thread), do: {:ok, :pass}

  @doc "Grants Community permissions to an existing member under the caller's transaction."
  def grant_community_in_transaction(user_id, community_id, %CommunityAdmin{} = member, additions)
      when is_integer(user_id) and is_integer(community_id) and is_map(additions) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, existing} <- community_existing(user_id, community_id, member),
         combined <-
           Map.merge(existing, additions, fn _key, old, value ->
             if value == false, do: old, else: value
           end),
         {:ok, normalized} <- Catalog.validate_permissions(:community, combined) do
      persist_community(user_id, community_id, member, normalized)
    end
  end

  @doc "Revokes Community permissions and their static dependents."
  def revoke_community_in_transaction(user_id, community_id, %CommunityAdmin{} = member, removals)
      when is_integer(user_id) and is_integer(community_id) and is_list(removals) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, existing} <- community_existing(user_id, community_id, member),
         {:ok, :pass} <- validate_removals(removals, :community),
         remaining <- cascade_removals(existing, removals),
         {:ok, normalized} <- Catalog.validate_permissions(:community, remaining) do
      persist_community(user_id, community_id, member, normalized)
    end
  end

  defp community_existing(user_id, community_id, %CommunityAdmin{
         user_id: user_id,
         community_id: community_id,
         permissions: permissions
       }) do
    Catalog.validate_permissions(:community, permissions)
  end

  defp community_existing(_, _, _), do: {:error, :permission_scope_mismatch}

  defp persist_community(
         user_id,
         community_id,
         %CommunityAdmin{id: id, revision: revision},
         permissions
       ) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {count, _} =
      CommunityAdmin
      |> where(
        [m],
        m.id == ^id and m.user_id == ^user_id and m.community_id == ^community_id and
          m.revision == ^revision
      )
      |> Repo.update_all(set: [permissions: permissions, updated_at: now], inc: [revision: 1])

    case count do
      1 -> {:ok, Repo.get!(CommunityAdmin, id)}
      0 -> {:error, :permission_revision_conflict}
    end
  end

  @doc "Grants permissions to an existing Article member in the caller transaction."
  def grant_article_in_transaction(
        user_id,
        article_id,
        %CMS.Model.ArticleCoAuthor{} = member,
        additions
      )
      when is_integer(user_id) and is_binary(article_id) and is_map(additions) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, existing} <- article_existing(user_id, article_id, member),
         combined <-
           Map.merge(existing, additions, fn _key, old, value ->
             if value == false, do: old, else: value
           end),
         {:ok, normalized} <- Catalog.validate_permissions(:article, combined) do
      persist_article(article_id, member, normalized)
    end
  end

  @doc "Revokes Article permissions and their static dependents in the caller transaction."
  def revoke_article_in_transaction(
        user_id,
        article_id,
        %CMS.Model.ArticleCoAuthor{} = member,
        removals
      )
      when is_integer(user_id) and is_binary(article_id) and is_list(removals) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, existing} <- article_existing(user_id, article_id, member),
         {:ok, :pass} <- validate_removals(removals, :article),
         remaining <- cascade_removals(existing, removals),
         {:ok, normalized} <- Catalog.validate_permissions(:article, remaining) do
      persist_article(article_id, member, normalized)
    end
  end

  defp article_existing(user_id, article_id, %CMS.Model.ArticleCoAuthor{
         article_id: article_id,
         author_id: author_id,
         permissions: permissions
       }) do
    if Repo.exists?(
         from(author in CMS.Model.Author,
           where: author.id == ^author_id and author.user_id == ^user_id
         )
       ) do
      Catalog.validate_permissions(:article, permissions)
    else
      {:error, :permission_scope_mismatch}
    end
  end

  defp article_existing(_, _, _), do: {:error, :permission_scope_mismatch}

  defp persist_article(
         article_id,
         %CMS.Model.ArticleCoAuthor{id: id, author_id: author_id, revision: revision},
         permissions
       ) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {count, _} =
      CMS.Model.ArticleCoAuthor
      |> where(
        [m],
        m.id == ^id and m.article_id == ^article_id and m.author_id == ^author_id and
          m.revision == ^revision
      )
      |> Repo.update_all(set: [permissions: permissions, updated_at: now], inc: [revision: 1])

    case count do
      1 -> {:ok, Repo.get!(CMS.Model.ArticleCoAuthor, id)}
      0 -> {:error, :permission_revision_conflict}
    end
  end

  @doc "Grants Global permissions, preserving other grants and the root flag."
  def grant_global_in_transaction(user_id, current, additions)
      when is_integer(user_id) and is_map(additions) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, raw_existing} <- existing_permissions(user_id, current),
         {:ok, existing} <- Catalog.validate_permissions(:global, raw_existing),
         combined <-
           Map.merge(existing, additions, fn _key, old, value ->
             if value == false, do: old, else: value
           end),
         {:ok, normalized} <- Catalog.validate_permissions(:global, combined) do
      persist_global(user_id, current, normalized)
    end
  end

  @doc "Revokes Global permissions and any grants that depend on them."
  def revoke_global_in_transaction(user_id, current, removals)
      when is_integer(user_id) and is_list(removals) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, raw_existing} <- existing_permissions(user_id, current),
         {:ok, existing} <- Catalog.validate_permissions(:global, raw_existing),
         {:ok, :pass} <- validate_removals(removals, :global),
         remaining <- cascade_removals(existing, removals),
         {:ok, normalized} <- Catalog.validate_permissions(:global, remaining) do
      persist_global(user_id, current, normalized)
    end
  end

  defp require_transaction do
    if Repo.in_transaction?(), do: {:ok, :pass}, else: {:error, :transaction_required}
  end

  defp existing_permissions(_user_id, nil), do: {:ok, %{}}

  defp existing_permissions(user_id, %GlobalPassport{user_id: user_id, permissions: permissions})
       when is_map(permissions),
       do: {:ok, permissions}

  defp existing_permissions(_user_id, _current), do: {:error, :permission_scope_mismatch}

  defp validate_removals(removals, scope) do
    Enum.reduce_while(removals, {:ok, :pass}, fn action, _acc ->
      case Catalog.get(action) do
        {:ok, %{scope: ^scope, grantable: true}} -> {:cont, {:ok, :pass}}
        {:ok, %{scope: ^scope}} -> {:halt, {:error, :permission_not_grantable}}
        {:ok, _} -> {:halt, {:error, :permission_scope_mismatch}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp cascade_removals(existing, removals) do
    remaining = Map.drop(existing, removals)

    dependent =
      Enum.filter(remaining, fn {action, true} ->
        {:ok, metadata} = Catalog.get(action)
        Enum.any?(metadata.requires, &(not Map.has_key?(remaining, &1)))
      end)
      |> Enum.map(&elem(&1, 0))

    if dependent == [], do: remaining, else: cascade_removals(remaining, dependent)
  end

  defp persist_global(user_id, nil, permissions) when map_size(permissions) == 0 do
    if Repo.exists?(from(passport in GlobalPassport, where: passport.user_id == ^user_id)) do
      {:error, :permission_revision_conflict}
    else
      {:ok, nil}
    end
  end

  defp persist_global(user_id, nil, permissions) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    id = Ecto.UUID.generate()

    case Repo.insert_all(
           GlobalPassport,
           [
             %{
               id: id,
               user_id: user_id,
               permissions: permissions,
               is_root: false,
               revision: 1,
               inserted_at: now,
               updated_at: now
             }
           ],
           on_conflict: :nothing,
           conflict_target: [:user_id]
         ) do
      {1, _} -> {:ok, Repo.get!(GlobalPassport, id)}
      {0, _} -> {:error, :permission_revision_conflict}
    end
  end

  defp persist_global(user_id, %GlobalPassport{id: id, revision: revision}, permissions) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {count, _} =
      GlobalPassport
      |> where(
        [passport],
        passport.id == ^id and passport.user_id == ^user_id and passport.revision == ^revision
      )
      |> Repo.update_all(set: [permissions: permissions, updated_at: now], inc: [revision: 1])

    case count do
      1 -> {:ok, Repo.get!(GlobalPassport, id)}
      0 -> {:error, :permission_revision_conflict}
    end
  end
end
