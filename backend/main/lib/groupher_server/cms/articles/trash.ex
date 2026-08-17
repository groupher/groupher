defmodule GroupherServer.CMS.Articles.Trash do
  @moduledoc """
  Current Trash lifecycle for every logical Article thread.

  Product tables retain draft/public rows while one `TrashedArticle` row makes
  the logical Article inactive. Docs Tree placement remains a Docs concern and
  attaches its structural snapshots to the same `TrashAction`.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Trash
        -> Repo / domain event
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.{Document, Lifecycle, Lock}
  alias CMS.Docs.Branch
  alias CMS.Docs.Trash, as: DocTrash
  alias CMS.Communities.TagStats

  alias CMS.Model.{
    ArtimentMention,
    ArticleLifecycle,
    Community,
    Doc,
    DocBranch,
    TrashAction,
    TrashedArticle,
    TrashedDocArticle,
    TrashedDocTreeNode
  }

  alias CMS.SearchArtiments.Indexer
  alias Helper.{Constant, ORM, T}

  require CMS.Const

  @audit_illegal Constant.CMS.pending(:illegal)
  @default_retention_days 30

  @doc """
  Restricts a queryable to articles without an active trash membership.

  The `:doc` clause filters against `TrashedDocArticle` using the branch
  coordinate; all other threads filter against `TrashedArticle`.

  ## Examples

      Post
      |> CMS.Articles.Trash.not_trashed_scope(:post)

  """
  @spec not_trashed_scope(Ecto.Queryable.t(), T.thread()) :: Ecto.Query.t()
  def not_trashed_scope(queryable, :doc) do
    from(article in queryable,
      as: :active_doc,
      where:
        not exists(
          from(trashed in TrashedDocArticle,
            where:
              trashed.community_id == parent_as(:active_doc).community_id and
                trashed.branch_id == parent_as(:active_doc).branch_id and
                trashed.article_hash_id == parent_as(:active_doc).article_hash_id,
            select: 1
          )
        )
    )
  end

  def not_trashed_scope(queryable, thread) do
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
    case thread do
      :doc ->
        TrashedDocArticle
        |> where([item], item.community_id == ^community.id)
        |> where([item], item.article_hash_id == ^article_hash_id)
        |> Repo.exists?()

      _ ->
        TrashedArticle
        |> where([item], item.community_id == ^community.id)
        |> where([item], item.thread == ^thread)
        |> where([item], item.article_hash_id == ^article_hash_id)
        |> Repo.exists?()
    end
  end

  @spec trashed_article?(map()) :: boolean()
  def trashed_article?(article) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(article) do
      case thread do
        :doc ->
          TrashedDocArticle
          |> where([item], item.community_id == ^article.community_id)
          |> where([item], item.branch_id == ^article.branch_id)
          |> where([item], item.article_hash_id == ^article.article_hash_id)
          |> Repo.exists?()

        _ ->
          TrashedArticle
          |> where([item], item.community_id == ^article.community_id)
          |> where([item], item.thread == ^thread)
          |> where([item], item.article_hash_id == ^article.article_hash_id)
          |> Repo.exists?()
      end
    else
      _ -> false
    end
  end

  @spec trash(map(), User.t() | nil, keyword()) :: T.domain_res(TrashedArticle.t())
  def trash(_article, _actor, _opts \\ [])

  def trash(%Doc{}, _actor, _opts),
    do: {:error, {:custom, "Doc deletion must go through the Docs Tree lifecycle"}}

  def trash(article, actor, opts) do
    result =
      with {:ok, thread} <- CMS.FrontDesk.thread_of(article),
           %Community{} = community <- Repo.get(Community, article.community_id) do
        case find_membership(community, thread, article.article_hash_id) do
          %TrashedArticle{} = item ->
            {:ok, item}

          nil ->
            with {:ok, canonical} <- CMS.Gate.access_check(actor, :delete, article) do
              Lock.run_for_article(community, thread, article, fn ->
                do_trash(community, thread, canonical.article_hash_id, actor, opts)
              end)
            end
        end
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
  def attach(_action, _community, _thread, _article_hash_id, _actor, _opts \\ [])

  def attach(
        %TrashAction{} = action,
        %Community{} = community,
        :doc,
        article_hash_id,
        actor,
        opts
      ) do
    with {:ok, branch} <- CMS.Docs.Branch.resolve(community, opts) do
      CMS.Docs.Trash.attach(action, community, branch, article_hash_id, actor, opts)
    end
  end

  def attach(
        %TrashAction{} = action,
        %Community{} = community,
        thread,
        article_hash_id,
        actor,
        opts
      ) do
    case find_membership(community, thread, article_hash_id) do
      %TrashedArticle{} = item ->
        {:ok, item}

      nil ->
        with {:ok, article} <- representative_article(community, thread, article_hash_id),
             {:ok, item} <-
               attach_article(action, community, thread, article_hash_id, article, actor, opts) do
          {:ok, item}
        end
    end
  end

  @doc "Attaches many logical Articles after bulk-loading memberships and representative rows."
  @spec attach_many(
          TrashAction.t(),
          Community.t(),
          T.thread(),
          [Ecto.UUID.t()],
          User.t() | nil,
          keyword()
        ) :: T.domain_res([TrashedArticle.t()])
  def attach_many(
        %TrashAction{} = action,
        %Community{} = community,
        thread,
        article_hash_ids,
        actor,
        opts \\ []
      ) do
    article_hash_ids = Enum.uniq(article_hash_ids)

    existing_by_hash_id =
      TrashedArticle
      |> where([item], item.community_id == ^community.id)
      |> where([item], item.thread == ^thread)
      |> where([item], item.article_hash_id in ^article_hash_ids)
      |> Repo.all()
      |> Map.new(&{&1.article_hash_id, &1})

    missing_ids = Enum.reject(article_hash_ids, &Map.has_key?(existing_by_hash_id, &1))

    with {:ok, articles_by_hash_id} <- representative_articles(community, thread, missing_ids) do
      article_hash_ids
      |> Enum.reduce_while({:ok, []}, fn article_hash_id, {:ok, items} ->
        case Map.fetch(existing_by_hash_id, article_hash_id) do
          {:ok, item} ->
            {:cont, {:ok, [item | items]}}

          :error ->
            article = Map.fetch!(articles_by_hash_id, article_hash_id)

            case attach_article(
                   action,
                   community,
                   thread,
                   article_hash_id,
                   article,
                   actor,
                   opts
                 ) do
              {:ok, item} -> {:cont, {:ok, [item | items]}}
              error -> {:halt, error}
            end
        end
      end)
      |> case do
        {:ok, items} -> {:ok, Enum.reverse(items)}
        error -> error
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
  def restore(_item_or_ref, _actor, _opts \\ [])

  def restore(%TrashedDocArticle{} = item, actor, opts) do
    result =
      with %Community{} = community <- Repo.get(Community, item.community_id),
           {:ok, branch} <- Branch.resolve(community, item.branch_id),
           %TrashAction{} = action <- Repo.get(TrashAction, item.trash_action_id) do
        doc_ids = doc_action_article_hash_ids(action, branch)

        Lock.run_doc_many(community, branch.id, doc_ids, fn ->
          with false <- action_has_other_children?(action.id, item.id, :doc),
               {:ok, [doc]} <-
                 DocTrash.restore_action_articles(action, community, branch, actor, opts),
               :ok <- delete_empty_action(action.id) do
            {:ok, doc}
          else
            true -> {:error, {:custom, "Trash action must be restored as one group"}}
            error -> error
          end
        end)
      else
        nil -> {:error, {:not_exist, "Trash Community"}}
        error -> error
      end

    sync_search(result, :upsert)
  end

  def restore(item_or_ref, actor, opts) do
    result =
      with {:ok, item} <- resolve_item(item_or_ref),
           %Community{} = community <- Repo.get(Community, item.community_id) do
        run_item_locked(community, item, fn ->
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
  def permanently_delete(_item_or_ref, _actor, _opts \\ [])

  def permanently_delete(%TrashedDocArticle{} = item, actor, opts) do
    result =
      with %Community{} = community <- Repo.get(Community, item.community_id),
           {:ok, branch} <- Branch.resolve(community, item.branch_id),
           %TrashAction{} = action <- Repo.get(TrashAction, item.trash_action_id) do
        doc_ids = doc_action_article_hash_ids(action, branch)

        Lock.run_doc_many(community, branch.id, doc_ids, fn ->
          with false <- action_has_other_children?(action.id, item.id, :doc),
               {:ok, :done} <-
                 DocTrash.permanently_delete_action_articles(
                   action,
                   community,
                   branch,
                   actor,
                   opts
                 ),
               :ok <- delete_empty_action(action.id) do
            {:ok, %{done: true}}
          else
            true ->
              {:error, {:custom, "Trash action must be permanently deleted as one group"}}

            error ->
              error
          end
        end)
      else
        nil -> {:error, {:not_exist, "Trash Community"}}
        error -> error
      end

    sync_search(result, {:delete, :doc, item.article_hash_id})
  end

  def permanently_delete(item_or_ref, actor, opts) do
    with {:ok, item} <- resolve_item(item_or_ref),
         %Community{} = community <- Repo.get(Community, item.community_id) do
      result =
        run_item_locked(community, item, fn ->
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
      |> where(
        [action],
        not exists(
          from(item in TrashedDocArticle,
            where: item.trash_action_id == parent_as(:action).id,
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
               {:ok, restore_state} <- trash_restore_state(article),
               {:ok, action} <-
                 create_action(community, actor, %{
                   root_type: :article,
                   root_ref: "#{thread}:#{article_hash_id}",
                   retention_days: Keyword.get(opts, :retention_days, @default_retention_days)
                 }),
               {:ok, item} <-
                 create_membership(
                   action,
                   community,
                   thread,
                   article_hash_id,
                   actor,
                   Keyword.put(opts, :restore_state, restore_state)
                 ),
               {:ok, _lifecycle} <-
                 Lifecycle.transition(community.id, thread, article_hash_id, :deleted),
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

  defp create_membership(action, community, thread, article_hash_id, actor, opts) do
    ORM.create(TrashedArticle, %{
      trash_action_id: action.id,
      community_id: community.id,
      thread: thread,
      article_hash_id: article_hash_id,
      restore_state: Keyword.fetch!(opts, :restore_state),
      deleted_by_id: actor_id(actor),
      deleted_at: action.deleted_at
    })
  end

  defp attach_article(action, community, thread, article_hash_id, article, actor, opts) do
    with {:ok, restore_state} <- trash_restore_state(article),
         {:ok, item} <-
           create_membership(
             action,
             community,
             thread,
             article_hash_id,
             actor,
             Keyword.put(opts, :restore_state, restore_state)
           ),
         {:ok, _lifecycle} <-
           Lifecycle.transition(community.id, thread, article_hash_id, :deleted),
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
         {:ok, _canonical} <- CMS.Gate.access_check(actor, :restore, article),
         {:ok, _} <- Repo.delete(item),
         {:ok, _lifecycle} <-
           Lifecycle.transition(
             community.id,
             item.thread,
             item.article_hash_id,
             item.restore_state
           ),
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

  defp run_item_locked(%Community{} = community, %TrashedArticle{} = item, fun) do
    Lock.run(community, item.thread, item.article_hash_id, fun)
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
         {:ok, _lifecycle} <-
           Lifecycle.transition(community.id, item.thread, item.article_hash_id, :destroy),
         :ok <- purge_article_aggregate(item.thread, item.article_hash_id, physical_articles),
         {_, _} <-
           Repo.delete_all(
             from(lifecycle in ArticleLifecycle,
               where:
                 lifecycle.community_id == ^community.id and
                   lifecycle.thread == ^item.thread and
                   lifecycle.article_hash_id == ^item.article_hash_id
             )
           ),
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

    other_docs? =
      TrashedDocArticle
      |> where([item], item.trash_action_id == ^action_id)
      |> Repo.exists?()

    other_articles? or other_docs? or tree_nodes?
  end

  defp action_has_other_children?(action_id, item_id, :doc) do
    other_articles? =
      TrashedArticle
      |> where([item], item.trash_action_id == ^action_id)
      |> Repo.exists?()

    other_docs? =
      TrashedDocArticle
      |> where([item], item.trash_action_id == ^action_id and item.id != ^item_id)
      |> Repo.exists?()

    tree_nodes? =
      TrashedDocTreeNode
      |> where([node], node.trash_action_id == ^action_id)
      |> Repo.exists?()

    other_articles? or other_docs? or tree_nodes?
  end

  defp doc_action_article_hash_ids(%TrashAction{} = action, %DocBranch{} = branch) do
    TrashedDocArticle
    |> where([item], item.trash_action_id == ^action.id and item.branch_id == ^branch.id)
    |> select([item], item.article_hash_id)
    |> order_by([item], asc: item.article_hash_id)
    |> Repo.all()
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
    _ = article_hash_id
    purge_physical_articles(thread, physical_articles)
  end

  defp purge_physical_articles(thread, physical_articles) do
    Enum.reduce_while(physical_articles, :ok, fn article, :ok ->
      with {:ok, _} <- CMS.ArtimentMentions.purge_article_comments(article),
           {:ok, _} <- CMS.ArtimentMentions.purge(article),
           {:ok, _} <- CMS.Assets.cleanup_refs(thread, article.id),
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

  defp representative_articles(_community, _thread, []), do: {:ok, %{}}

  defp representative_articles(%Community{} = community, thread, article_hash_ids) do
    with {:ok, info} <- match(thread) do
      public_stage = CMS.Const.stage(:public)

      articles_by_hash_id =
        info.model
        |> where([article], article.community_id == ^community.id)
        |> where([article], article.article_hash_id in ^article_hash_ids)
        |> order_by([article], desc: article.stage == ^public_stage)
        |> preload([:community_tags, :communities, author: :user])
        |> Repo.all()
        |> Enum.reduce(%{}, fn article, acc ->
          Map.put_new(acc, article.article_hash_id, article)
        end)

      case Enum.find(article_hash_ids, &(not Map.has_key?(articles_by_hash_id, &1))) do
        nil -> {:ok, articles_by_hash_id}
        _missing_id -> {:error, {:not_exist, "logical Article"}}
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

  defp trash_restore_state(article) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(article),
         {:ok, state} <- Lifecycle.state(article.community_id, thread, article.article_hash_id) do
      if state == :archived,
        do: {:error, {:archived, "article is archived, can not be deleted"}},
        else: {:ok, state}
    end
  end

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
