defmodule GroupherServer.CMS.Articles.Trash do
  @moduledoc """
  Current Trash lifecycle for every logical Article thread.

  Product tables retain draft/public rows while one `TrashedArticle` row makes
  the logical Article inactive. Docs Tree placement remains a Docs concern and
  attaches its structural snapshots to the same `TrashAction`.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.{Document, Lock}
  alias CMS.Communities.TagStats

  alias CMS.Model.{
    ArtimentMention,
    ArticleSnapshot,
    Community,
    TrashAction,
    TrashedArticle,
    TrashedDocTreeNode
  }

  alias CMS.SearchArtiments.Indexer
  alias Helper.{Constant, ORM, T}

  require CMS.Const

  @audit_illegal Constant.CMS.pending(:illegal)
  @default_retention_days 30

  @spec active_scope(Ecto.Queryable.t(), T.thread()) :: Ecto.Query.t()
  def active_scope(queryable, thread) do
    from(article in queryable,
      as: :active_article,
      where:
        not exists(
          from(trashed in TrashedArticle,
            where:
              trashed.community_id == parent_as(:active_article).community_id and
                trashed.thread == ^thread and
                trashed.article_hash_id == parent_as(:active_article).article_hash_id,
            select: 1
          )
        )
    )
  end

  @spec trashed?(Community.t(), T.thread(), Ecto.UUID.t()) :: boolean()
  def trashed?(%Community{} = community, thread, article_hash_id) do
    TrashedArticle
    |> where([item], item.community_id == ^community.id)
    |> where([item], item.thread == ^thread)
    |> where([item], item.article_hash_id == ^article_hash_id)
    |> Repo.exists?()
  end

  @spec trashed_article?(map()) :: boolean()
  def trashed_article?(article) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(article) do
      TrashedArticle
      |> where([item], item.community_id == ^article.community_id)
      |> where([item], item.thread == ^thread)
      |> where([item], item.article_hash_id == ^article.article_hash_id)
      |> Repo.exists?()
    else
      _ -> false
    end
  end

  @spec trash(map(), User.t() | nil, keyword()) :: T.domain_res(TrashedArticle.t())
  def trash(article, actor, opts \\ []) do
    result =
      with {:ok, thread} <- CMS.FrontDesk.thread_of(article),
           %Community{} = community <- Repo.get(Community, article.community_id) do
        Lock.run(community, thread, article.article_hash_id, fn ->
          do_trash(community, thread, article.article_hash_id, actor, opts)
        end)
      else
        nil -> {:error, {:not_exist, "Article Community"}}
        error -> error
      end

    sync_search(result, :delete)
  end

  @doc """
  Creates one Article membership under an already-created action.

  This is intentionally domain-specific for Docs subtree orchestration and
  assumes the caller already owns the Article lifecycle lock and transaction.
  """
  @spec attach(
          TrashAction.t(),
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          User.t() | nil,
          keyword()
        ) :: T.domain_res(TrashedArticle.t())
  def attach(
        %TrashAction{} = action,
        %Community{} = community,
        thread,
        article_hash_id,
        actor,
        opts \\ []
      ) do
    case find_membership(community, thread, article_hash_id) do
      %TrashedArticle{} = item ->
        {:ok, item}

      nil ->
        with {:ok, article} <- representative_article(community, thread, article_hash_id),
             :ok <- ensure_trashable(article),
             {:ok, item} <-
               create_membership(action, community, thread, article_hash_id, actor, opts),
             {:ok, _mentions} <- CMS.ArtimentMentions.mark_target_state(article, :trashed),
             :ok <- update_visibility_stats(article, thread, :trash),
             {:ok, _audit} <-
               maybe_record_audit(
                 "article.trashed",
                 %{
                   community_id: community.id,
                   actor: actor,
                   resource_type: to_string(thread),
                   resource_ref: article_hash_id,
                   resource_snapshot: article_snapshot(article, thread),
                   operation_ref: action.hash_id,
                   source: Keyword.get(opts, :source, "api"),
                   metadata: Keyword.get(opts, :metadata, %{})
                 },
                 opts
               ) do
          {:ok, item}
        end
    end
  end

  @doc "Restores all Article memberships in one action while the caller owns their locks."
  @spec restore_action_articles(TrashAction.t(), Community.t(), User.t() | nil, keyword()) ::
          T.domain_res([map()])
  def restore_action_articles(
        %TrashAction{} = action,
        %Community{} = community,
        actor,
        opts \\ []
      ) do
    items =
      TrashedArticle
      |> where([item], item.trash_action_id == ^action.id)
      |> order_by([item], asc: item.thread, asc: item.article_hash_id)
      |> lock("FOR UPDATE")
      |> Repo.all()

    items
    |> Enum.reduce_while({:ok, []}, fn item, {:ok, articles} ->
      case restore_membership(item, action, community, actor, opts) do
        {:ok, article} -> {:cont, {:ok, [article | articles]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, articles} -> {:ok, Enum.reverse(articles)}
      error -> error
    end
  end

  @doc "Permanently deletes every Article aggregate in one action under caller-owned locks."
  @spec permanently_delete_action_articles(
          TrashAction.t(),
          Community.t(),
          User.t() | nil,
          keyword()
        ) :: T.domain_res(:done)
  def permanently_delete_action_articles(
        %TrashAction{} = action,
        %Community{} = community,
        actor,
        opts \\ []
      ) do
    items =
      TrashedArticle
      |> where([item], item.trash_action_id == ^action.id)
      |> order_by([item], asc: item.thread, asc: item.article_hash_id)
      |> lock("FOR UPDATE")
      |> Repo.all()

    Enum.reduce_while(items, {:ok, :done}, fn item, {:ok, :done} ->
      case permanently_delete_membership(item, action, community, actor, opts) do
        {:ok, :done} -> {:cont, {:ok, :done}}
        error -> {:halt, error}
      end
    end)
  end

  @spec restore(Ecto.UUID.t() | TrashedArticle.t(), User.t() | nil, keyword()) ::
          T.domain_res(map())
  def restore(item_or_ref, actor, opts \\ []) do
    result =
      with {:ok, item} <- resolve_item(item_or_ref),
           %Community{} = community <- Repo.get(Community, item.community_id) do
        Lock.run(community, item.thread, item.article_hash_id, fn ->
          do_restore(item.id, community, actor, opts)
        end)
      else
        nil -> {:error, {:not_exist, "Trash Community"}}
        error -> error
      end

    sync_search(result, :upsert)
  end

  @spec permanently_delete(Ecto.UUID.t() | TrashedArticle.t(), User.t() | nil, keyword()) ::
          T.domain_res(map())
  def permanently_delete(item_or_ref, actor, opts \\ []) do
    with {:ok, item} <- resolve_item(item_or_ref),
         %Community{} = community <- Repo.get(Community, item.community_id) do
      result =
        Lock.run(community, item.thread, item.article_hash_id, fn ->
          do_permanently_delete(item.id, community, actor, opts)
        end)

      sync_search(result, {:delete, item.thread, item.article_hash_id})
    else
      nil -> {:error, {:not_exist, "Trash Community"}}
      error -> error
    end
  end

  @spec get(Ecto.UUID.t()) :: T.domain_res(TrashedArticle.t())
  def get(hash_id) do
    TrashedArticle
    |> where([item], item.hash_id == ^hash_id)
    |> preload([:trash_action, :deleted_by])
    |> Repo.one()
    |> case do
      %TrashedArticle{} = item -> {:ok, hydrate(item)}
      nil -> {:error, {:not_exist, "TrashedArticle"}}
    end
  end

  @spec list(Community.t(), map()) :: T.domain_res(map())
  def list(%Community{} = community, filter \\ %{}) do
    page = Map.get(filter, :page, 1)
    size = Map.get(filter, :size, 20)

    query =
      TrashedArticle
      |> where([item], item.community_id == ^community.id)
      |> maybe_filter_thread(Map.get(filter, :thread))
      |> order_by([item], desc: item.deleted_at, desc: item.id)
      |> preload([:trash_action, :deleted_by])

    paged = ORM.paginator(query, page: page, size: size)
    {:ok, %{paged | entries: hydrate_entries(paged.entries, community)}}
  end

  @spec create_action(Community.t(), User.t() | nil, map()) :: T.domain_res(TrashAction.t())
  def create_action(%Community{} = community, actor, attrs) do
    now = Map.get(attrs, :deleted_at, DateTime.utc_now(:second))
    retention_days = Map.get(attrs, :retention_days, @default_retention_days)

    ORM.create(TrashAction, %{
      community_id: community.id,
      actor_id: actor_id(actor),
      root_type: to_string(Map.fetch!(attrs, :root_type)),
      root_ref: to_string(Map.fetch!(attrs, :root_ref)),
      deleted_at: now,
      scheduled_permanent_deletion_at: DateTime.add(now, retention_days * 86_400, :second)
    })
  end

  @spec delete_empty_action(T.id()) :: :ok | {:error, term()}
  def delete_empty_action(action_id) do
    {count, _} =
      TrashAction
      |> from(as: :action)
      |> where([action], action.id == ^action_id)
      |> where(
        [action],
        not exists(
          from(item in TrashedArticle,
            where: item.trash_action_id == parent_as(:action).id,
            select: 1
          )
        )
      )
      |> where(
        [action],
        not exists(
          from(node in TrashedDocTreeNode,
            where: node.trash_action_id == parent_as(:action).id,
            select: 1
          )
        )
      )
      |> Repo.delete_all()

    if count in [0, 1], do: :ok, else: {:error, {:custom, "invalid Trash action cleanup"}}
  end

  defp do_trash(community, thread, article_hash_id, actor, opts) do
    with :ok <- ensure_standalone_trash_supported(thread) do
      case find_membership(community, thread, article_hash_id) do
        %TrashedArticle{} = item ->
          {:ok, item}

        nil ->
          with {:ok, article} <- representative_article(community, thread, article_hash_id),
               :ok <- ensure_trashable(article),
               {:ok, action} <-
                 create_action(community, actor, %{
                   root_type: :article,
                   root_ref: "#{thread}:#{article_hash_id}",
                   retention_days: Keyword.get(opts, :retention_days, @default_retention_days)
                 }),
               {:ok, item} <-
                 create_membership(action, community, thread, article_hash_id, actor, opts),
               {:ok, _mentions} <- CMS.ArtimentMentions.mark_target_state(article, :trashed),
               :ok <- update_visibility_stats(article, thread, :trash),
               {:ok, _audit} <-
                 CMS.Audit.record("article.trashed", %{
                   community_id: community.id,
                   actor: actor,
                   resource_type: to_string(thread),
                   resource_ref: article_hash_id,
                   resource_snapshot: article_snapshot(article, thread),
                   operation_ref: action.hash_id,
                   source: Keyword.get(opts, :source, "api"),
                   metadata: %{}
                 }) do
            {:ok, item}
          end
      end
    end
  end

  defp create_membership(action, community, thread, article_hash_id, actor, _opts) do
    ORM.create(TrashedArticle, %{
      trash_action_id: action.id,
      community_id: community.id,
      thread: thread,
      article_hash_id: article_hash_id,
      deleted_by_id: actor_id(actor),
      deleted_at: action.deleted_at
    })
  end

  defp do_restore(item_id, community, actor, opts) do
    item =
      TrashedArticle
      |> where([item], item.id == ^item_id)
      |> lock("FOR UPDATE")
      |> Repo.one()

    case item do
      nil ->
        {:error, {:not_exist, "TrashedArticle"}}

      %TrashedArticle{} = item ->
        action =
          TrashAction
          |> where([action], action.id == ^item.trash_action_id)
          |> lock("FOR UPDATE")
          |> Repo.one!()

        with false <- action_has_other_children?(action.id, item.id),
             {:ok, article} <- restore_membership(item, action, community, actor, opts),
             :ok <- delete_empty_action(action.id) do
          {:ok, article}
        else
          true -> {:error, {:custom, "Trash action must be restored as one group"}}
          error -> error
        end
    end
  end

  defp restore_membership(item, action, community, actor, opts) do
    with {:ok, article} <-
           representative_article(community, item.thread, item.article_hash_id),
         {:ok, _} <- Repo.delete(item),
         {:ok, _mentions} <- CMS.ArtimentMentions.mark_target_state(article, :active),
         :ok <- update_visibility_stats(article, item.thread, :restore),
         {:ok, _audit} <-
           maybe_record_audit(
             "article.restored",
             %{
               community_id: community.id,
               actor: actor,
               resource_type: to_string(item.thread),
               resource_ref: item.article_hash_id,
               resource_snapshot: article_snapshot(article, item.thread),
               operation_ref: action.hash_id,
               source: Keyword.get(opts, :source, "api"),
               metadata: Keyword.get(opts, :metadata, %{})
             },
             opts
           ) do
      {:ok, article}
    end
  end

  defp do_permanently_delete(item_id, community, actor, opts) do
    item =
      TrashedArticle
      |> where([item], item.id == ^item_id)
      |> lock("FOR UPDATE")
      |> Repo.one()

    case item do
      nil ->
        {:ok, %{done: true}}

      %TrashedArticle{} = item ->
        action =
          TrashAction
          |> where([action], action.id == ^item.trash_action_id)
          |> lock("FOR UPDATE")
          |> Repo.one!()

        with false <- action_has_other_children?(action.id, item.id),
             {:ok, :done} <-
               permanently_delete_membership(item, action, community, actor, opts),
             :ok <- delete_empty_action(action.id) do
          {:ok, %{done: true}}
        else
          true -> {:error, {:custom, "Trash action must be permanently deleted as one group"}}
          error -> error
        end
    end
  end

  defp permanently_delete_membership(item, action, community, actor, opts) do
    with {:ok, article} <-
           representative_article(community, item.thread, item.article_hash_id),
         {:ok, physical_articles} <-
           physical_articles(community, item.thread, item.article_hash_id),
         :ok <- purge_article_aggregate(item.thread, item.article_hash_id, physical_articles),
         {:ok, _} <- Repo.delete(item),
         {:ok, _audit} <-
           maybe_record_audit(
             "article.permanently_deleted",
             %{
               community_id: community.id,
               actor: actor,
               resource_type: to_string(item.thread),
               resource_ref: item.article_hash_id,
               resource_snapshot: article_snapshot(article, item.thread),
               operation_ref: action.hash_id,
               source: Keyword.get(opts, :source, "api"),
               metadata: Keyword.get(opts, :metadata, %{})
             },
             opts
           ),
         {:ok, _user} <-
           GroupherServer.Accounts.Publish.update_states(article.author.user, item.thread) do
      Indexer.enqueue_delete(item.thread, item.article_hash_id)
      {:ok, :done}
    end
  end

  defp action_has_other_children?(action_id, item_id) do
    other_articles? =
      TrashedArticle
      |> where([item], item.trash_action_id == ^action_id and item.id != ^item_id)
      |> Repo.exists?()

    tree_nodes? =
      TrashedDocTreeNode
      |> where([node], node.trash_action_id == ^action_id)
      |> Repo.exists?()

    other_articles? or tree_nodes?
  end

  defp physical_articles(%Community{} = community, thread, article_hash_id) do
    with {:ok, info} <- match(thread) do
      articles =
        info.model
        |> where([article], article.community_id == ^community.id)
        |> where([article], article.article_hash_id == ^article_hash_id)
        |> preload([:community_tags, :communities, author: :user])
        |> Repo.all()

      {:ok, articles}
    end
  end

  defp purge_article_aggregate(thread, article_hash_id, physical_articles) do
    with :ok <- purge_physical_articles(thread, physical_articles),
         {_count, _} <-
           ArticleSnapshot
           |> where([snapshot], snapshot.thread == ^thread)
           |> where([snapshot], snapshot.article_hash_id == ^article_hash_id)
           |> Repo.delete_all() do
      :ok
    end
  end

  defp purge_physical_articles(thread, physical_articles) do
    Enum.reduce_while(physical_articles, :ok, fn article, :ok ->
      with {:ok, _} <- CMS.ArtimentMentions.purge_article_comments(article),
           {:ok, _} <- CMS.ArtimentMentions.purge(article),
           {:ok, _} <- CMS.Assets.purge_article_refs(thread, article.id),
           _ <- Document.remove(thread, article.id),
           {:ok, _} <- CMS.Covers.delete_cover_edit_info(article.cover_edit_info_id),
           {:ok, _} <- Repo.delete(article) do
        {:cont, :ok}
      else
        error -> {:halt, error}
      end
    end)
  end

  defp resolve_item(%TrashedArticle{} = item), do: {:ok, item}
  defp resolve_item(hash_id) when is_binary(hash_id), do: get(hash_id)

  defp find_membership(%Community{} = community, thread, article_hash_id) do
    Repo.get_by(TrashedArticle,
      community_id: community.id,
      thread: thread,
      article_hash_id: article_hash_id
    )
  end

  defp representative_article(%Community{} = community, thread, article_hash_id) do
    with {:ok, info} <- match(thread) do
      public_stage = CMS.Const.stage(:public)

      info.model
      |> where([article], article.community_id == ^community.id)
      |> where([article], article.article_hash_id == ^article_hash_id)
      |> order_by([article], desc: article.stage == ^public_stage)
      |> limit(1)
      |> preload([:community_tags, :communities, author: :user])
      |> Repo.one()
      |> case do
        nil -> {:error, {:not_exist, "logical Article"}}
        article -> {:ok, article}
      end
    end
  end

  defp hydrate(%TrashedArticle{} = item) do
    community = Repo.get!(Community, item.community_id)
    [hydrated] = hydrate_entries([item], community)
    hydrated
  end

  defp hydrate_entries(items, %Community{} = community) do
    hydrated_by_id =
      items
      |> Enum.group_by(& &1.thread)
      |> Enum.reduce(%{}, fn {thread, thread_items}, acc ->
        Map.merge(acc, hydrate_thread_entries(thread_items, community, thread))
      end)

    Enum.map(items, &Map.fetch!(hydrated_by_id, &1.id))
  end

  defp hydrate_thread_entries(items, %Community{} = community, thread) do
    article_hash_ids = Enum.map(items, & &1.article_hash_id)
    public_stage = CMS.Const.stage(:public)

    articles_by_hash_id =
      with {:ok, info} <- match(thread) do
        info.model
        |> where([article], article.community_id == ^community.id)
        |> where([article], article.article_hash_id in ^article_hash_ids)
        |> order_by([article], desc: article.stage == ^public_stage)
        |> preload([:community_tags, :communities, author: :user])
        |> Repo.all()
        |> Enum.reduce(%{}, fn article, acc ->
          Map.put_new(acc, article.article_hash_id, article)
        end)
      else
        _ -> %{}
      end

    mention_counts =
      articles_by_hash_id
      |> Map.values()
      |> Enum.map(& &1.id)
      |> mentioned_by_counts(thread)

    Map.new(items, fn item ->
      article = Map.get(articles_by_hash_id, item.article_hash_id)
      mentioned_by_count = if article, do: Map.get(mention_counts, article.id, 0), else: 0
      {item.id, %{item | article: article, mentioned_by_count: mentioned_by_count}}
    end)
  end

  defp mentioned_by_counts([], _thread), do: %{}

  defp mentioned_by_counts(article_ids, thread) do
    ArtimentMention
    |> where([mention], mention.mentioned_scope == :internal)
    |> where([mention], mention.mentioned_type == ^thread)
    |> where([mention], mention.mentioned_id in ^article_ids)
    |> group_by([mention], mention.mentioned_id)
    |> select([mention], {mention.mentioned_id, count(mention.id)})
    |> Repo.all()
    |> Map.new()
  end

  defp ensure_trashable(%{is_archived: true}),
    do: {:error, {:archived, "article is archived, can not be deleted"}}

  defp ensure_trashable(_article), do: :ok

  defp ensure_standalone_trash_supported(:doc),
    do: {:error, {:custom, "Docs Articles must be moved to Trash through their Tree node"}}

  defp ensure_standalone_trash_supported(_thread), do: :ok

  defp update_visibility_stats(article, thread, operation) do
    if visible_public_article?(article) do
      delta = if operation == :trash, do: :dec, else: :inc

      with :ok <- update_tag_stats(article, delta),
           {:ok, _} <- CMS.Communities.update_count_field(article.communities, thread) do
        :ok
      end
    else
      :ok
    end
  end

  defp update_tag_stats(article, delta) do
    article = Repo.preload(article, :community_tags)

    Enum.reduce_while(article.community_tags, :ok, fn tag, :ok ->
      case apply(TagStats, delta, [article, tag]) do
        {:ok, :pass} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  defp visible_public_article?(article) do
    article.stage == CMS.Const.stage(:public) and article.pending != @audit_illegal
  end

  defp article_snapshot(article, thread) do
    %{
      title: article.title,
      thread: thread,
      author_id: article.author_id
    }
  end

  defp actor_id(%User{id: id}), do: id
  defp actor_id(_actor), do: nil

  defp maybe_record_audit(action, attrs, opts) do
    if Keyword.get(opts, :audit, true),
      do: CMS.Audit.record(action, attrs),
      else: {:ok, :skipped}
  end

  defp maybe_filter_thread(query, nil), do: query
  defp maybe_filter_thread(query, thread), do: where(query, [item], item.thread == ^thread)

  defp sync_search({:ok, %TrashedArticle{} = item} = result, :delete) do
    Indexer.enqueue_delete(item.thread, item.article_hash_id)
    result
  end

  defp sync_search({:ok, article} = result, :upsert) do
    Indexer.enqueue_upsert(article)
    result
  end

  defp sync_search({:ok, _} = result, {:delete, thread, article_hash_id}) do
    Indexer.enqueue_delete(thread, article_hash_id)
    result
  end

  defp sync_search(result, _action), do: result
end
