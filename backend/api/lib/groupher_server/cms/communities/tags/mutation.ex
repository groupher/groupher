defmodule GroupherServer.CMS.Communities.Tags.Mutation do
  @moduledoc """
  Owns the write-side orchestration for community tags and tag groups.

  This module never starts a transaction. A concrete user Command, Gate callback, or
  explicitly named maintenance workflow must own the surrounding transaction and pass
  the resulting identity to taxonomy effects.

  Business position:

      Command / maintenance workflow
        -> Tags.Mutation
        -> Tags.Persist
        -> taxonomy Outbox
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  import GroupherServer.CMS.Articles.Writer,
    only: [ensure_author_exists: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User

  alias CMS.Communities.ErrorCat
  alias CMS.Communities.Tags.Persist
  alias CMS.FrontDesk

  alias CMS.Model.{Community, CommunityTag, CommunityTagGroup}
  alias Helper.{ORM, T}

  @spec create(Community.t(), atom(), map(), User.t(), keyword()) ::
          {:ok, CommunityTag.t()} | {:error, Ecto.Changeset.t()}
  def create(%Community{} = community, thread, attrs, %User{id: user_id}, opts) do
    {attrs, opts} = split_identity(attrs, opts)

    with {:ok, author} <- ensure_author_exists(%User{id: user_id}),
         {:ok, community} <- ORM.find_by(Community, slug: community.slug),
         {:ok, group} <-
           find_group_in_thread(
             community,
             thread,
             Map.get(attrs, :group_id),
             Map.get(attrs, :group),
             opts
           ) do
      require_transaction(fn ->
        attrs =
          Map.merge(attrs, %{
            author_id: author.id,
            community_id: community.id,
            group_id: group.id,
            thread: thread
          })
          |> Map.drop([:group])

        with {:ok, tag} <-
               Persist.create_tag(
                 community,
                 thread,
                 Map.drop(attrs, [:author_id, :community_id, :group_id, :thread]),
                 author.id,
                 group.id
               ),
             {:ok, _} <- CMS.Communities.update_count_field(community, :community_tags_count),
             {:ok, _} <- invalidate_taxonomy(community, thread, "tag:create:#{tag.id}", opts) do
          tag
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  def update(id, attrs, opts), do: update_with_identity(id, attrs, opts)

  defp update_with_identity(id, attrs, opts) do
    {attrs, opts} = split_identity(attrs, opts)

    with {:ok, tag} <- FrontDesk.community_tag(id),
         {:ok, attrs} <- normalize_update_attrs(tag, attrs) do
      require_transaction(fn ->
        with {:ok, updated} <- Persist.update_tag(tag, attrs),
             {:ok, _} <-
               invalidate_taxonomy_by_tag(
                 updated,
                 "tag:update:#{updated.id}:#{updated.updated_at}",
                 opts
               ) do
          updated
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  def create_group(%Community{} = community, thread, attrs, opts) do
    {attrs, opts} = split_identity(attrs, opts)

    with {:ok, community} <- ORM.find_by(Community, slug: community.slug) do
      require_transaction(fn ->
        with {:ok, group} <-
               Persist.create_group(
                 community,
                 thread,
                 attrs,
                 next_group_index(community, thread)
               ),
             {:ok, _} <-
               invalidate_taxonomy(community, thread, "tag-group:create:#{group.id}", opts),
             {:ok, group} <- preload_group_tags({:ok, group}) do
          group
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  def update_group(%Community{} = community, thread, id, attrs, opts) do
    {attrs, opts} = split_identity(attrs, opts)

    with {:ok, community} <- ORM.find_by(Community, slug: community.slug),
         {:ok, group} <- find_group_in_thread(community, thread, id) do
      require_transaction(fn ->
        with {:ok, updated} <- Persist.update_group(group, attrs),
             {:ok, _} <-
               invalidate_taxonomy(
                 community,
                 thread,
                 "tag-group:update:#{updated.id}:#{updated.updated_at}",
                 opts
               ),
             {:ok, updated} <- {:ok, updated} do
          updated
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  def delete_group(%Community{} = community, thread, id, opts) do
    with {:ok, community} <- ORM.find_by(Community, slug: community.slug),
         {:ok, group} <- find_group_in_thread(community, thread, id) do
      require_transaction(fn ->
        with {:ok, deleted_group} <- delete_group_and_update_count(community, group),
             {:ok, _} <-
               invalidate_taxonomy(community, thread, "tag-group:delete:#{group.id}", opts) do
          deleted_group
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  defp delete_group_and_update_count(community, group) do
    case Persist.delete_group(group) do
      {:ok, deleted_group} ->
        case CMS.Communities.update_count_field(community, :community_tags_count) do
          {:ok, _} -> {:ok, deleted_group}
          {:error, reason} -> Repo.rollback(reason)
        end

      {:error, reason} ->
        Repo.rollback(reason)
    end
  end

  def delete(id, opts) do
    with {:ok, tag} <- FrontDesk.community_tag(id),
         {:ok, community} <- ORM.find(Community, tag.community_id) do
      require_transaction(fn ->
        with {:ok, deleted_tag} <- Persist.delete_tag(tag),
             {:ok, _} <- CMS.Communities.update_count_field(community, :community_tags_count),
             {:ok, _} <- invalidate_taxonomy(community, tag.thread, "tag:delete:#{tag.id}", opts) do
          deleted_tag
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  @spec reindex_in_group(Community.t(), atom(), T.id(), list(), keyword()) ::
          {:ok, atom()} | {:error, any()}
  def reindex_in_group(%Community{} = community, thread, group_id, indexed_tags, opts) do
    with {:ok, group_tags} <- find_group_tags(community, thread, group_id),
         {:ok, indexed_tags} <- normalize_indexed_tags(indexed_tags, false),
         {:ok, _} <- validate_complete_reindex(group_tags, indexed_tags) do
      run_batch_reindex(
        community,
        thread,
        "tag:reindex:group:#{group_id}:#{:erlang.phash2(indexed_tags)}",
        opts,
        fn -> batch_reindex_tags(community, thread, indexed_tags, false) end
      )
    end
  end

  @spec reindex(Community.t(), atom(), list(), keyword()) :: {:ok, atom()} | {:error, any()}
  def reindex(%Community{} = community, thread, indexed_tags, opts) do
    with {:ok, indexed_tags} <- normalize_indexed_tags(indexed_tags, true),
         {:ok, _} <- validate_indexed_tags(community, thread, indexed_tags),
         {:ok, _} <- validate_indexed_tags_groups(community, thread, indexed_tags) do
      run_batch_reindex(
        community,
        thread,
        "tag:reindex:#{:erlang.phash2(indexed_tags)}",
        opts,
        fn -> batch_reindex_tags(community, thread, indexed_tags, true) end
      )
    end
  end

  @spec reindex_groups(Community.t() | String.t(), atom(), list(), keyword()) ::
          {:ok, atom()} | {:error, any()}
  def reindex_groups(%Community{} = community, thread, indexed_groups, opts) do
    with {:ok, indexed_groups} <- normalize_indexed_tags(indexed_groups, false),
         {:ok, _} <- validate_indexed_groups(community, thread, indexed_groups) do
      run_batch_reindex(
        community,
        thread,
        "tag:reindex-groups:#{:erlang.phash2(indexed_groups)}",
        opts,
        fn -> batch_reindex_groups(community, thread, indexed_groups) end
      )
    end
  end

  defp find_group_in_thread(%Community{} = community, thread, group_id, _group_title, _opts)
       when not is_nil(group_id) do
    find_group_in_thread(community, thread, group_id)
  end

  defp find_group_in_thread(%Community{} = community, thread, _group_id, group_title, opts)
       when is_binary(group_title) do
    title = String.trim(group_title)

    if title === "" do
      invalid_domain_tag("tag group required")
    else
      CommunityTagGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.thread == ^thread)
      |> where([g], g.title == ^title)
      |> Repo.one()
      |> case do
        %CommunityTagGroup{} = group ->
          {:ok, group}

        _ ->
          create_group(community, thread, %{title: title}, opts)
      end
    end
  end

  defp find_group_in_thread(_, _, _, _, _opts) do
    invalid_domain_tag("tag group required")
  end

  defp find_group_in_thread(%Community{} = community, thread, group_id)
       when not is_nil(group_id) do
    group_id = cast_id!(group_id)

    CommunityTagGroup
    |> where([g], g.community_id == ^community.id)
    |> where([g], g.thread == ^thread)
    |> where([g], g.id == ^group_id)
    |> Repo.one()
    |> case do
      %CommunityTagGroup{} = group -> {:ok, group}
      _ -> invalid_domain_tag("tag group not in same community & thread")
    end
  end

  defp normalize_update_attrs(%CommunityTag{} = tag, attrs) do
    attrs = Map.drop(attrs, [:group])

    case Map.get(attrs, :group_id) do
      nil ->
        {:ok, attrs}

      group_id ->
        with {:ok, _group} <-
               find_group_in_thread(%Community{id: tag.community_id}, tag.thread, group_id) do
          {:ok, attrs}
        end
    end
  end

  defp normalize_indexed_tags(indexed_tags, include_group?) do
    normalized =
      Enum.map(indexed_tags, fn item ->
        item
        |> Map.put(:id, cast_id!(item.id))
        |> Map.put(:index, cast_index!(item.index))
        |> then(fn item ->
          if include_group?, do: Map.put(item, :group_id, cast_id!(item.group_id)), else: item
        end)
      end)

    ids = Enum.map(normalized, & &1.id)

    if length(ids) == MapSet.size(MapSet.new(ids)) do
      {:ok, normalized}
    else
      invalid_domain_tag("duplicate ids in reindex payload")
    end
  end

  defp validate_complete_reindex(group_tags, indexed_tags) do
    group_ids = MapSet.new(group_tags, & &1.id)
    indexed_ids = MapSet.new(indexed_tags, & &1.id)

    if group_ids == indexed_ids do
      {:ok, :pass}
    else
      invalid_domain_tag("reindex payload must contain exactly the tags in the group")
    end
  end

  defp validate_indexed_tags(%Community{} = community, thread, indexed_tags) do
    ids = Enum.map(indexed_tags, & &1.id)

    valid_ids =
      CommunityTag
      |> where([t], t.community_id == ^community.id)
      |> where([t], t.thread == ^thread)
      |> where([t], t.id in ^ids)
      |> select([t], t.id)
      |> Repo.all()
      |> MapSet.new()

    if MapSet.new(ids) == valid_ids do
      {:ok, :pass}
    else
      invalid_domain_tag("tag not in same community & thread")
    end
  end

  defp validate_indexed_tags_groups(%Community{} = community, thread, indexed_tags) do
    group_ids = indexed_tags |> Enum.map(& &1.group_id) |> Enum.uniq()

    valid_group_ids =
      CommunityTagGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.thread == ^thread)
      |> where([g], g.id in ^group_ids)
      |> select([g], g.id)
      |> Repo.all()
      |> MapSet.new()

    if MapSet.new(group_ids) == valid_group_ids do
      {:ok, :pass}
    else
      invalid_domain_tag("tag group not in same community & thread")
    end
  end

  defp validate_indexed_groups(%Community{} = community, thread, indexed_groups) do
    ids = Enum.map(indexed_groups, & &1.id)

    valid_ids =
      CommunityTagGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.thread == ^thread)
      |> where([g], g.id in ^ids)
      |> select([g], g.id)
      |> Repo.all()
      |> MapSet.new()

    if MapSet.new(ids) == valid_ids do
      {:ok, :pass}
    else
      invalid_domain_tag("tag group not in same community & thread")
    end
  end

  defp run_batch_reindex(community, thread, effect_key, opts, update_fun) do
    require_transaction(fn ->
      case update_fun.() do
        {:ok, :pass} ->
          case invalidate_taxonomy(community, thread, effect_key, opts) do
            {:ok, _} -> :pass
            {:error, reason} -> Repo.rollback(reason)
          end

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  defp batch_reindex_tags(community, thread, indexed_tags, include_group?) do
    Persist.batch_reindex_tags(community, thread, indexed_tags, include_group?)
    |> expect_updated_rows(length(indexed_tags))
  end

  defp batch_reindex_groups(community, thread, indexed_groups) do
    Persist.batch_reindex_groups(community, thread, indexed_groups)
    |> expect_updated_rows(length(indexed_groups))
  end

  defp expect_updated_rows({:ok, :pass}, 0), do: {:ok, :pass}
  defp expect_updated_rows({:ok, expected}, expected), do: {:ok, :pass}

  defp expect_updated_rows({:ok, _result}, _expected) do
    invalid_domain_tag("reindex target changed")
  end

  defp cast_id!(id) do
    case Ecto.Type.cast(:id, id) do
      {:ok, casted_id} -> casted_id
      :error -> invalid_domain_tag("invalid tag group id")
    end
  end

  defp cast_index!(index) do
    case Ecto.Type.cast(:integer, index) do
      {:ok, casted_index} -> casted_index
      :error -> raise ArgumentError, "invalid tag index"
    end
  end

  defp next_group_index(%Community{} = community, thread) do
    CommunityTagGroup
    |> where([g], g.community_id == ^community.id)
    |> where([g], g.thread == ^thread)
    |> select([g], max(g.index))
    |> Repo.one()
    |> case do
      nil -> 0
      index -> index + 1
    end
  end

  defp find_group_tags(%Community{} = community, thread, group_id) do
    group_id = cast_id!(group_id)

    CommunityTag
    |> where([t], t.community_id == ^community.id)
    |> where([t], t.thread == ^thread)
    |> where([t], t.group_id == ^group_id)
    |> Repo.all()
    |> done
  end

  defp preload_group_tags({:ok, %CommunityTagGroup{} = group}) do
    {:ok, Repo.preload(group, tags: [:community, :tag_group])}
  end

  defp preload_group_tags(result), do: result

  defp invalidate_taxonomy(%Community{} = community, thread, effect_key, opts) do
    with {:ok, identity} <- taxonomy_identity(community, thread, opts),
         {:ok, _event} <-
           CMS.Outbox.send(%{
             event: "community.taxonomy_changed",
             worker: CMS.Outbox.Workers.Community.Cleanup,
             resource_type: "community",
             resource_id: community.id,
             identity: identity,
             effect_key: effect_key,
             data: %{community: community.slug, community_id: community.id, thread: thread}
           }) do
      {:ok, :pass}
    end
  end

  defp invalidate_taxonomy_by_tag(tag, effect_key, opts) do
    community = Repo.get!(Community, tag.community_id)
    invalidate_taxonomy(community, tag.thread, effect_key, opts)
  end

  defp taxonomy_identity(%Community{}, _thread, opts) do
    case Keyword.get(opts, :identity) do
      {:command, command_id} when is_binary(command_id) ->
        {:ok, {:command, command_id}}

      {:workflow, workflow_ref} when is_binary(workflow_ref) and workflow_ref != "" ->
        {:ok, {:workflow, workflow_ref}}

      nil ->
        case Keyword.get(opts, :command_id) do
          command_id when is_binary(command_id) ->
            case Ecto.UUID.cast(command_id) do
              {:ok, command_id} -> {:ok, {:command, command_id}}
              :error -> {:error, :invalid_taxonomy_identity}
            end

          _ ->
            {:error, :taxonomy_identity_required}
        end

      _ ->
        {:error, :invalid_taxonomy_identity}
    end
  end

  defp split_identity(attrs, opts) when is_map(attrs) do
    command_id = Map.get(attrs, :command_id) || Map.get(attrs, "command_id")
    identity = Map.get(attrs, :identity) || Map.get(attrs, "identity")

    {Map.drop(attrs, [:command_id, "command_id", :identity, "identity"]),
     opts |> maybe_command_id(command_id) |> maybe_identity(identity)}
  end

  defp split_identity(attrs, opts), do: {attrs, opts}

  defp maybe_command_id(opts, nil), do: opts
  defp maybe_command_id(opts, command_id), do: Keyword.put(opts, :command_id, command_id)

  defp maybe_identity(opts, nil), do: opts
  defp maybe_identity(opts, identity), do: Keyword.put(opts, :identity, identity)

  # Gate/Command or an explicitly named maintenance workflow owns the
  # surrounding aggregate transaction. Tags.Mutation never opens a transaction
  # for a caller, so an unclassified writer cannot silently become an owner.
  defp require_transaction(fun) when is_function(fun, 0) do
    if Repo.in_transaction?(), do: {:ok, fun.()}, else: {:error, :tag_transaction_required}
  end

  defp invalid_domain_tag(details), do: {:error, ErrorCat.invalid_domain_tag(details)}
end
