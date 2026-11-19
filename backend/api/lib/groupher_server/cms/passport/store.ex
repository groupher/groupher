defmodule GroupherServer.CMS.Passport.Store do
  @moduledoc """
  Persists Passport facts inside the transaction owned by a domain command.

      command lock and actor admission -> Store -> versioned authorization row

  The caller must lock the target User and load the current row in that same
  transaction before calling these functions. This module does not authorize
  the acting user or change root status.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.Model.{Community, CommunityAdmin, GlobalPassport}
  alias CMS.Passport.Scope.Article, as: ArticleScope
  alias CMS.Passport.Scope.Community, as: CommunityScope
  alias CMS.Passport.Scope.Global, as: GlobalScope
  alias Accounts.Model.User
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

  @doc "Checks a Global action using actor-bound Global facts."
  def allowed_global?(actor, scope, action, thread \\ nil)

  def allowed_global?(
        %User{id: user_id},
        %CMS.Passport.Scope.Global{actor_id: user_id, global: global},
        action,
        thread
      )
      when is_integer(user_id) do
    with {:ok, %{scope: :global} = metadata} <- Catalog.get(action),
         {:ok, :pass} <- require_action_thread(metadata, thread),
         {:ok, requirements} <- Catalog.requirements(action, thread) do
      allowed =
        global.is_root or
          (Map.get(global.permissions, action) == true and
             Enum.all?(requirements, &(Map.get(global.permissions, &1) == true)))

      {:ok, allowed}
    else
      {:ok, _metadata} -> {:error, :permission_scope_mismatch}
      {:error, _reason} = error -> error
    end
  end

  def allowed_global?(_, _, _, _), do: {:error, :invalid_scope}

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

  @doc "Returns current review-read grants from canonical Global and Community Passport rows."
  def review_scope_grants(%User{id: user_id} = actor) when is_integer(user_id) do
    with {:ok, %GlobalScope{global: global} = global_scope} <- load_global_scope(actor),
         {:ok, platform?} <-
           allowed_global?(actor, global_scope, CMS.GateAction.review_platform_read()) do
      community_ids =
        if global.is_root do
          []
        else
          Repo.all(
            from(member in CommunityAdmin,
              where: member.user_id == ^user_id,
              select: %{
                community_id: member.community_id,
                is_lord: member.is_lord,
                permissions: member.permissions
              }
            )
          )
          |> Enum.reduce([], fn member, ids ->
            with {:ok, permissions} <-
                   Catalog.validate_permissions(:community, member.permissions),
                 scope <- %CommunityScope{
                   actor_id: user_id,
                   community_id: member.community_id,
                   global: global,
                   community: %{is_lord: member.is_lord, permissions: permissions}
                 },
                 {:ok, true} <- allowed_community?(actor, scope, CMS.GateAction.review_read()) do
              [member.community_id | ids]
            else
              _ -> ids
            end
          end)
        end

      {:ok,
       %{
         platform?: platform?,
         community_all?: global.is_root,
         community_ids: Enum.uniq(community_ids)
       }}
    end
  end

  def review_scope_grants(_), do: {:error, :invalid_scope}

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

  @doc """
  Builds a query predicate for the current Passport facts required by an action.

  Community predicates may target a fixed Community id or correlate against a
  named Community binding already present in the caller's query.
  """
  def action_predicate(user_id, scope, action, thread \\ nil)

  def action_predicate(user_id, :global, action, thread) when is_integer(user_id) do
    with {:ok, %{scope: :global, grantable: grantable}} <- Catalog.get(action),
         {:ok, :pass} <- require_action_thread_for_predicate(action, thread),
         {:ok, requirements} <- Catalog.requirements(action, thread),
         {:ok, root_query} <- valid_permissions_query(GlobalPassport, user_id, :global),
         root_query <-
           where(root_query, [passport_member: passport], passport.is_root),
         {:ok, root_query} <- select_one(root_query) do
      if grantable do
        with {:ok, grant_query} <- valid_permissions_query(GlobalPassport, user_id, :global),
             grant_query <- where_action_permissions(grant_query, [action | requirements]),
             {:ok, grant_query} <- select_one(grant_query) do
          {:ok, union_permission_queries([root_query, grant_query])}
        end
      else
        {:ok, root_query}
      end
    else
      {:ok, _metadata} -> {:error, :permission_scope_mismatch}
      {:error, _reason} = error -> error
    end
  end

  def action_predicate(user_id, {:community, community_id}, action, thread)
      when is_integer(user_id) and is_integer(community_id) do
    with {:ok, %{scope: :community, grantable: grantable}} <- Catalog.get(action),
         {:ok, :pass} <- require_action_thread_for_predicate(action, thread),
         {:ok, requirements} <- Catalog.requirements(action, thread),
         {:ok, global_root_query} <- valid_permissions_query(GlobalPassport, user_id, :global),
         global_root_query <-
           where(global_root_query, [passport_member: passport], passport.is_root),
         {:ok, global_root_query} <- select_one(global_root_query),
         {:ok, community_lord_query} <-
           valid_permissions_query(CommunityAdmin, user_id, :community),
         community_lord_query <-
           where(
             community_lord_query,
             [passport_member: member],
             member.community_id == ^community_id and member.is_lord
           ),
         {:ok, community_lord_query} <- select_one(community_lord_query) do
      if grantable do
        with {:ok, community_grant_query} <-
               valid_permissions_query(CommunityAdmin, user_id, :community),
             community_grant_query <-
               where(
                 community_grant_query,
                 [passport_member: member],
                 member.community_id == ^community_id
               ),
             community_grant_query <-
               where_action_permissions(community_grant_query, [action | requirements]),
             {:ok, community_grant_query} <- select_one(community_grant_query) do
          {:ok,
           union_permission_queries([
             global_root_query,
             community_lord_query,
             community_grant_query
           ])}
        end
      else
        {:ok, union_permission_queries([global_root_query, community_lord_query])}
      end
    else
      {:ok, _metadata} -> {:error, :permission_scope_mismatch}
      {:error, _reason} = error -> error
    end
  end

  def action_predicate(user_id, {:community_binding, binding_name}, action, thread)
      when is_integer(user_id) and is_atom(binding_name) do
    with {:ok, %{scope: :community, grantable: grantable}} <- Catalog.get(action),
         {:ok, :pass} <- require_action_thread_for_predicate(action, thread),
         {:ok, requirements} <- Catalog.requirements(action, thread),
         {:ok, global_root_query} <- valid_permissions_query(GlobalPassport, user_id, :global),
         global_root_query <-
           where(global_root_query, [passport_member: passport], passport.is_root),
         {:ok, global_root_query} <- select_one(global_root_query),
         {:ok, community_lord_query} <-
           valid_permissions_query(CommunityAdmin, user_id, :community),
         community_lord_query <-
           where(
             community_lord_query,
             [passport_member: member],
             member.community_id == field(parent_as(^binding_name), :id) and member.is_lord
           ),
         {:ok, community_lord_query} <- select_one(community_lord_query) do
      if grantable do
        with {:ok, community_grant_query} <-
               valid_permissions_query(CommunityAdmin, user_id, :community),
             community_grant_query <-
               where(
                 community_grant_query,
                 [passport_member: member],
                 member.community_id == field(parent_as(^binding_name), :id)
               ),
             community_grant_query <-
               where_action_permissions(community_grant_query, [action | requirements]),
             {:ok, community_grant_query} <- select_one(community_grant_query) do
          {:ok,
           union_permission_queries([
             global_root_query,
             community_lord_query,
             community_grant_query
           ])}
        end
      else
        {:ok, union_permission_queries([global_root_query, community_lord_query])}
      end
    else
      {:ok, _metadata} -> {:error, :permission_scope_mismatch}
      {:error, _reason} = error -> error
    end
  end

  def action_predicate(_, _, _, _), do: {:error, :invalid_scope}

  defp valid_permissions_query(schema, user_id, scope) do
    query =
      from(passport in schema,
        as: :passport_member,
        where: passport.user_id == ^user_id
      )

    case permissions_valid_predicates(scope) do
      {:ok, predicates} ->
        {:ok, Enum.reduce(predicates, query, fn predicate, acc -> where(acc, ^predicate) end)}

      {:error, _reason} = error ->
        error
    end
  end

  defp select_one(query), do: {:ok, select(query, 1)}

  defp union_permission_queries([query]), do: query

  defp union_permission_queries([query | rest]) do
    Enum.reduce(rest, query, fn next_query, combined ->
      union_all(combined, ^next_query)
    end)
  end

  defp where_action_permissions(query, actions) do
    Enum.reduce(actions, query, fn action, acc ->
      where(acc, ^permission_predicate(action))
    end)
  end

  defp permission_predicate(action) do
    dynamic(
      [],
      fragment(
        "? -> ? = 'true'::jsonb",
        field(as(:passport_member), :permissions),
        ^action
      )
    )
  end

  defp permissions_valid_predicates(scope) do
    case Catalog.list(scope) do
      {:ok, entries} ->
        grantable_actions =
          entries
          |> Enum.filter(& &1.metadata.grantable)
          |> Enum.map(& &1.action)

        allowed_keys_path =
          case grantable_actions do
            [] ->
              "$.keyvalue()"

            actions ->
              allowed = Enum.map_join(actions, " || ", &"@.key == #{Jason.encode!(&1)}")
              "$.keyvalue() ? (!(#{allowed}))"
          end

        invalid_type_path = "$.* ? (@.type() != \"boolean\")"

        invalid_dependencies_path =
          entries
          |> Enum.filter(&(&1.metadata.grantable and &1.metadata.requires != []))
          |> Enum.map_join(" || ", fn %{action: action, metadata: metadata} ->
            action_ref = json_path_key(action)

            requirements =
              Enum.map_join(metadata.requires, " && ", fn required_action ->
                "exists(#{json_path_key(required_action)} ? (@ == true))"
              end)

            "(#{action_ref} == true && !(#{requirements}))"
          end)
          |> case do
            "" -> "$ ? (1 == 0)"
            conditions -> "$ ? (#{conditions})"
          end

        permissions_valid =
          dynamic(
            [],
            fragment(
              "jsonb_typeof(?) = 'object' AND NOT jsonb_path_exists(?, (?::text)::jsonpath) AND NOT jsonb_path_exists(?, (?::text)::jsonpath) AND NOT jsonb_path_exists(?, (?::text)::jsonpath)",
              field(as(:passport_member), :permissions),
              field(as(:passport_member), :permissions),
              ^invalid_type_path,
              field(as(:passport_member), :permissions),
              ^allowed_keys_path,
              field(as(:passport_member), :permissions),
              ^invalid_dependencies_path
            )
          )

        {:ok, [permissions_valid]}

      {:error, _reason} = error ->
        error
    end
  end

  defp json_path_key(action), do: "@." <> Jason.encode!(action)

  defp require_action_thread_for_predicate(action, nil) do
    with {:ok, metadata} <- Catalog.get(action) do
      if map_size(metadata.requires_thread) > 0 do
        {:error, :thread_required}
      else
        {:ok, :pass}
      end
    end
  end

  defp require_action_thread_for_predicate(_action, _thread), do: {:ok, :pass}

  @doc "Checks Article facts already bound to the current actor and Article."
  def allowed_article?(
        %User{id: user_id},
        %ArticleScope{
          actor_id: user_id,
          owner_user_id: owner_user_id,
          global: global,
          membership: membership
        },
        action
      )
      when is_integer(user_id) do
    with {:ok, %{scope: :article} = metadata} <- Catalog.get(action),
         {:ok, requirements} <- Catalog.requirements(action) do
      member_permissions = if membership, do: membership.permissions, else: %{}
      owner_allowed = owner_user_id == user_id and CMS.Passport.owner_article_action?(action)

      member_allowed =
        metadata.grantable and Map.get(member_permissions, action) == true and
          Enum.all?(requirements, &(Map.get(member_permissions, &1) == true))

      {:ok, global.is_root or owner_allowed or member_allowed}
    else
      {:ok, _metadata} -> {:error, :permission_scope_mismatch}
      {:error, _reason} = error -> error
    end
  end

  def allowed_article?(_, _, _), do: {:error, :invalid_scope}

  defp require_action_thread(%{requires_thread: requirements}, nil)
       when map_size(requirements) > 0 do
    {:error, :thread_required}
  end

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
       when is_map(permissions) do
    {:ok, permissions}
  end

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
