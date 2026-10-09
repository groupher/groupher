defmodule GroupherServer.CMS.Articles.Tags.Assignment do
  @moduledoc """
  Owns Article-to-community-tag association changes.

  Community tag CRUD and reindexing remain under `CMS.Communities.Tags.Mutation`;
  this module owns only the Article binding, tag statistics, and taxonomy effect
  that follow an assignment change. The caller owns the transaction and supplies
  either a command identity or an explicit workflow identity.

      Article Command / maintenance workflow
        -> Gate admission
        -> Articles.Tags.Assignment
        -> ArticleBinding tags + tag stats + taxonomy Outbox
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Communities.ErrorCat
  alias CMS.Communities.Tags.Stats
  alias CMS.FrontDesk
  alias CMS.Articles.Bindings.Tags, as: BindingTags
  alias CMS.Model.{Article, ArticleBinding, Community, CommunityTag}
  alias Helper.T

  @doc "Replaces all community tags on an Article inside the caller-owned transaction."
  @spec overwrite(Community.t(), atom(), Ecto.Schema.t(), map(), keyword()) ::
          {:ok, Ecto.Schema.t()} | {:error, any()}
  def overwrite(%Community{id: community_id}, thread, article, %{community_tags: tag_ids}, opts) do
    in_caller_transaction(fn ->
      check_filter = %{community_id: community_id, thread: thread}

      with {:ok, related_tags} <- find_related_tags(tag_ids, check_filter) do
        do_update_tags_assoc(article, related_tags, :overwrite, community_id, opts)
      end
    end)
  end

  @doc "Adds one community tag to an Article inside the caller-owned transaction."
  @spec add(Ecto.Schema.t(), T.id(), keyword()) :: {:ok, Ecto.Schema.t()} | {:error, any()}
  def add(article, tag_id, opts) do
    in_caller_transaction(fn ->
      with {:ok, tag} <- FrontDesk.community_tag(tag_id) do
        do_update_tags_assoc(article, [tag], :add, tag.community_id, opts)
      end
    end)
  end

  @doc "Removes one community tag from an Article inside the caller-owned transaction."
  @spec remove(Ecto.Schema.t(), T.id(), keyword()) :: {:ok, Ecto.Schema.t()} | {:error, any()}
  def remove(article, tag_id, opts) do
    in_caller_transaction(fn ->
      with {:ok, tag} <- FrontDesk.community_tag(tag_id) do
        do_update_tags_assoc(article, [tag], :remove, tag.community_id, opts)
      end
    end)
  end

  defp do_update_tags_assoc(article, tags, opt, community_id, opts) when is_list(tags) do
    case Ecto.UUID.cast(Map.get(article, :id)) do
      {:ok, article_id} -> update_stable_tags(article, article_id, tags, opt, community_id, opts)
      :error -> {:error, :article_binding_context_required}
    end
  end

  defp update_stable_tags(article, article_id, tags, opt, community_id, opts)
       when is_integer(community_id) do
    case Repo.get_by(ArticleBinding, article_id: article_id, community_id: community_id) do
      %ArticleBinding{} = binding ->
        old_tags =
          CommunityTag
          |> join(:inner, [tag], assignment in CMS.Model.ArticleBindingTag,
            on: assignment.tag_id == tag.id
          )
          |> where([_tag, assignment], assignment.article_binding_id == ^binding.id)
          |> order_by([tag, _assignment], asc: tag.id)
          |> Repo.all()

        removing_ids = MapSet.new(tags, & &1.id)

        community_tags =
          case opt do
            :add -> Enum.uniq_by(old_tags ++ tags, & &1.id)
            :remove -> Enum.reject(old_tags, &MapSet.member?(removing_ids, &1.id))
            :overwrite -> tags
          end

        updated_article = Map.put(article, :community_tags, community_tags)

        with {:ok, _binding} <-
               BindingTags.replace(binding, Enum.map(community_tags, & &1.id)),
             {:ok, _} <- sync_tag_stats(updated_article, Repo.get!(Article, article_id), old_tags),
             {:ok, thread} <- FrontDesk.thread_of(article),
             {:ok, _} <-
               maybe_invalidate_taxonomy(
                 old_tags,
                 community_tags,
                 Repo.get!(Community, community_id),
                 thread,
                 "article-tags:#{binding.id}:#{:erlang.phash2(Enum.map(community_tags, & &1.id))}",
                 opts
               ) do
          {:ok, updated_article}
        end

      nil ->
        {:error, ErrorCat.not_exist("ArticleBinding")}
    end
  end

  defp update_stable_tags(_article, _article_id, _tags, _opt, _community_id, _opts),
    do: {:error, :article_binding_context_required}

  defp maybe_invalidate_taxonomy(old_tags, new_tags, community, thread, effect_key, opts) do
    old_ids = MapSet.new(old_tags, & &1.id)
    new_ids = MapSet.new(new_tags, & &1.id)

    if old_ids == new_ids do
      {:ok, :pass}
    else
      invalidate_taxonomy(community, thread, effect_key, opts)
    end
  end

  defp find_related_tags([], _filter), do: {:ok, []}

  defp find_related_tags(tag_ids, %{community_id: community_id, thread: thread}) do
    casted_tag_ids = tag_ids |> Enum.map(&cast_id!/1) |> Enum.uniq()
    positions = casted_tag_ids |> Enum.with_index() |> Map.new()

    tags =
      CommunityTag
      |> where([t], t.community_id == ^community_id)
      |> where([t], t.thread == ^thread)
      |> where([t], t.id in ^casted_tag_ids)
      |> Repo.all()
      |> Enum.sort_by(&Map.fetch!(positions, &1.id))

    if length(tags) == length(casted_tag_ids) do
      {:ok, tags}
    else
      invalid_domain_tag("tag not in same community & thread")
    end
  end

  defp sync_tag_stats(updated_article, article, old_tags) do
    new_tags = Map.get(updated_article, :community_tags, [])

    old_ids = MapSet.new(Enum.map(old_tags, & &1.id))
    new_ids = MapSet.new(Enum.map(new_tags, & &1.id))

    added_tags = Enum.reject(new_tags, &MapSet.member?(old_ids, &1.id))
    removed_tags = Enum.reject(old_tags, &MapSet.member?(new_ids, &1.id))

    deltas = Enum.map(added_tags, &{&1, 1}) ++ Enum.map(removed_tags, &{&1, -1})

    case Stats.update_many(article, deltas) do
      {:ok, _result} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

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

  defp in_caller_transaction(fun) when is_function(fun, 0) do
    if Repo.in_transaction?(), do: fun.(), else: {:error, :article_tag_transaction_required}
  end

  defp cast_id!(id) do
    case Ecto.Type.cast(:id, id) do
      {:ok, casted_id} -> casted_id
      :error -> invalid_domain_tag("invalid tag id")
    end
  end

  defp invalid_domain_tag(details), do: {:error, ErrorCat.invalid_domain_tag(details)}
end
