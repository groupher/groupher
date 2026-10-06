defmodule GroupherServer.CMS.Articles.Trash do
  @moduledoc """
  Owns stable ordinary-Article Trash membership and aggregate destruction.

      stable Article -> Lifecycle :deleted -> TrashedArticle
                     -> restore or permanent aggregate deletion

  Doc membership remains branch-scoped under `CMS.Docs.Trash`. Trash keeps the
  Draft/Public/Revision aggregate intact until permanent deletion.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Activity, CMS, Repo}
  alias CMS.Articles.Lifecycle
  alias CMS.Communities.TagStats
  alias CMS.Docs.Trash, as: DocTrash

  alias CMS.Model.{
    Article,
    ArticleCommunity,
    ArticleCommunityTag,
    ArticlePublic,
    ArticleStats,
    ArtimentMention,
    Community,
    CommunityTag,
    TrashAction,
    TrashedArticle,
    TrashedDocArticle,
    TrashedDocTreeNode
  }

  alias Helper.ORM

  @default_retention_days 30

  @doc "Excludes stable Articles with an active ordinary Trash membership."
  @spec not_trashed_scope(Ecto.Queryable.t(), atom()) :: Ecto.Query.t()
  def not_trashed_scope(queryable, _thread) do
    from(article in queryable,
      as: :article,
      where:
        not exists(
          from(item in TrashedArticle,
            where: item.article_id == parent_as(:article).id,
            select: 1
          )
        )
    )
  end

  @doc "Returns whether one stable Article currently belongs to Trash."
  @spec trashed_article?(map()) :: boolean()
  def trashed_article?(%{article_id: article_id}) when is_binary(article_id) do
    Repo.exists?(from(item in TrashedArticle, where: item.article_id == ^article_id))
  end

  def trashed_article?(%Article{id: article_id}) do
    Repo.exists?(from(item in TrashedArticle, where: item.article_id == ^article_id))
  end

  def trashed_article?(_article), do: false

  @doc "Creates the shared audit/grouping row for a Trash operation."
  @spec create_action(Community.t(), term(), map()) :: {:ok, TrashAction.t()} | {:error, term()}
  def create_action(%Community{} = community, actor, attrs) do
    now = DateTime.utc_now(:second)
    retention_days = Map.get(attrs, :retention_days, @default_retention_days)

    ORM.create(TrashAction, %{
      community_id: community.id,
      actor_id: actor_id(actor),
      root_type: attrs.root_type |> to_string(),
      root_ref: to_string(attrs.root_ref),
      deleted_at: now,
      scheduled_permanent_deletion_at: DateTime.add(now, retention_days, :day)
    })
  end

  @doc "Deletes an empty TrashAction after its final membership is removed."
  @spec delete_empty_action(pos_integer()) :: :ok | {:error, term()}
  def delete_empty_action(action_id) do
    occupied? =
      Enum.any?([TrashedArticle, TrashedDocArticle, TrashedDocTreeNode], fn model ->
        Repo.exists?(from(item in model, where: item.trash_action_id == ^action_id))
      end)

    if occupied? do
      :ok
    else
      case Repo.get(TrashAction, action_id) do
        nil -> :ok
        action -> action |> Repo.delete() |> normalize_delete()
      end
    end
  end

  @doc "Moves one ordinary stable Article into Trash without deleting its workspace."
  @spec trash(Article.t() | map(), term(), keyword()) ::
          {:ok, TrashedArticle.t()} | {:error, term()}
  def trash(article, actor, opts \\ [])

  def trash(%{article_id: article_id}, actor, opts) when is_binary(article_id) do
    trash(Repo.get(Article, article_id), actor, opts)
  end

  def trash(%Article{thread: :doc}, _actor, _opts) do
    {:error,
     CMS.Articles.ErrorCat.custom("Doc Trash is owned by the branch-scoped Docs Tree lifecycle")}
  end

  def trash(%Article{} = article, actor, opts) do
    CMS.Gate.Access.with_check(actor, :delete, article, fn canonical ->
      case Repo.get_by(TrashedArticle, article_id: canonical.id) do
        %TrashedArticle{} = item -> {:ok, item}
        nil -> create_trash_membership(canonical, actor, opts)
      end
    end)
  end

  def trash(_article, _actor, _opts) do
    {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
  end

  @doc "Restores one ordinary Article membership or delegates branch-local Doc restore."
  @spec restore(Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(), term(), keyword()) ::
          {:ok, Article.t()} | {:error, term()}
  def restore(item_or_id, actor, opts \\ [])

  def restore(%TrashedDocArticle{} = item, actor, opts) do
    with %Community{} = community <- Repo.get(Community, item.community_id),
         %CMS.Model.DocBranch{} = branch <- Repo.get(CMS.Model.DocBranch, item.branch_id) do
      DocTrash.restore(item, community, branch, actor, opts)
    else
      _ -> {:error, CMS.Articles.ErrorCat.not_exist("TrashedDocArticle")}
    end
  end

  def restore(item_or_id, actor, _opts) do
    with {:ok, %TrashedArticle{} = item} <- resolve_item(item_or_id),
         %Article{} = article <- Repo.get(Article, item.article_id) do
      CMS.Gate.Access.with_check(actor, :restore, article, fn canonical ->
        with {:ok, lifecycle} <- Lifecycle.lock(canonical),
             {:ok, _lifecycle} <- Lifecycle.transition(lifecycle, item.restore_state),
             {:ok, _deleted} <- Repo.delete(item),
             :ok <- update_tag_stats(canonical, 1),
             :ok <- update_community_count(canonical),
             :ok <- delete_empty_action(item.trash_action_id),
             {:ok, _mentions} <- CMS.ArtimentMentions.mark_target_state(canonical, :active) do
          _ = CMS.SearchArtiments.Indexer.enqueue_upsert(canonical)
          {:ok, canonical}
        end
      end)
    else
      nil -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Permanently deletes one trashed aggregate or delegates a Doc branch deletion."
  @spec permanently_delete(
          Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(),
          term(),
          keyword()
        ) ::
          {:ok, map() | :done} | {:error, term()}
  def permanently_delete(item_or_id, actor, opts \\ [])

  def permanently_delete(%TrashedDocArticle{} = item, actor, opts) do
    with %Community{} = community <- Repo.get(Community, item.community_id),
         %CMS.Model.DocBranch{} = branch <- Repo.get(CMS.Model.DocBranch, item.branch_id) do
      DocTrash.permanently_delete(item, community, branch, actor, opts)
    else
      _ -> {:error, CMS.Articles.ErrorCat.not_exist("TrashedDocArticle")}
    end
  end

  def permanently_delete(item_or_id, actor, opts) do
    with {:ok, %TrashedArticle{} = item} <- resolve_item(item_or_id),
         %Article{} = article <- Repo.get(Article, item.article_id) do
      CMS.Gate.Access.with_check(actor, :permanently_delete, article, fn canonical ->
        action_id = item.trash_action_id

        with {:ok, lifecycle} <- Lifecycle.lock(canonical),
             {:ok, _lifecycle} <- Lifecycle.transition(lifecycle, :destroy),
             {:ok, _event} <-
               activity(canonical, :permanently_deleted, actor, item.trash_action,
                 source: activity_source(opts)
               ),
             {:ok, _comment_mentions} <-
               CMS.ArtimentMentions.purge_article_comments(canonical),
             {:ok, _article_mentions} <- CMS.ArtimentMentions.purge(canonical),
             {:ok, _asset_refs} <- CMS.Assets.cleanup_refs(canonical.thread, canonical.id),
             {:ok, _deleted} <- Repo.delete(canonical),
             :ok <- delete_empty_action(action_id) do
          _ = CMS.SearchArtiments.Indexer.enqueue_delete(canonical)
          {:ok, %{done: true, article_id: canonical.id}}
        end
      end)
    else
      nil -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Gets a Trash membership by its opaque Trash hash id."
  @spec get(Ecto.UUID.t()) :: {:ok, TrashedArticle.t() | TrashedDocArticle.t()} | {:error, term()}
  def get(hash_id) do
    case Repo.get_by(TrashedArticle, hash_id: hash_id) do
      %TrashedArticle{} = item ->
        {:ok, item |> Repo.preload([:article, :trash_action]) |> hydrate_item()}

      nil ->
        get_doc_item(hash_id)
    end
  end

  @doc "Lists ordinary stable Article Trash memberships for one Community."
  @spec list(Community.t(), map()) :: {:ok, map()}
  def list(%Community{} = community, filter \\ %{}) do
    page = Map.get(filter, :page, 1)
    size = Map.get(filter, :size, 20)

    paged =
      TrashedArticle
      |> where([item], item.community_id == ^community.id)
      |> order_by([item], desc: item.deleted_at)
      |> preload([:article, :trash_action])
      |> ORM.paginator(page: page, size: size)

    {:ok, Map.update!(paged, :entries, &Enum.map(&1, fn item -> hydrate_item(item) end))}
  end

  defp hydrate_item(%TrashedArticle{article: %Article{} = article} = item) do
    public = Repo.get(ArticlePublic, article.id)
    stats = Repo.get_by(ArticleStats, article_id: article.id, thread: article.thread)

    projection =
      article
      |> Map.from_struct()
      |> Map.put(:title, public && public.title)
      |> Map.put(:article_stats, stats)

    mentioned_by_count =
      Repo.aggregate(
        from(mention in ArtimentMention,
          where:
            mention.mentioned_scope == :internal and
              mention.mentioned_article_id == ^article.id
        ),
        :count
      )

    %{item | article: projection, mentioned_by_count: mentioned_by_count}
  end

  defp create_trash_membership(canonical, actor, opts) do
    with %Community{} = community <- Repo.get(Community, canonical.community_id),
         {:ok, lifecycle} <- Lifecycle.lock(canonical),
         {:ok, action} <-
           create_action(community, actor, %{
             root_type: :article,
             root_ref: canonical.id,
             retention_days: Keyword.get(opts, :retention_days, @default_retention_days)
           }),
         :ok <- update_tag_stats(canonical, -1),
         {:ok, item} <- create_membership(action, canonical, lifecycle.state, actor),
         {:ok, _lifecycle} <- Lifecycle.transition(lifecycle, :deleted),
         :ok <- update_community_count(canonical),
         {:ok, _mentions} <- CMS.ArtimentMentions.mark_target_state(canonical, :trashed),
         {:ok, _event} <- activity(canonical, :trashed, actor, action) do
      _ = CMS.SearchArtiments.Indexer.enqueue_delete(canonical)
      {:ok, item}
    else
      nil -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
      {:error, reason} -> {:error, reason}
    end
  end

  defp create_membership(action, article, restore_state, actor) do
    %TrashedArticle{}
    |> TrashedArticle.changeset(%{
      trash_action_id: action.id,
      community_id: article.community_id,
      thread: article.thread,
      article_id: article.id,
      restore_state: restore_state,
      deleted_by_id: actor_id(actor),
      deleted_at: action.deleted_at
    })
    |> Repo.insert()
  end

  defp update_tag_stats(article, delta) when delta in [-1, 1] do
    tags =
      CommunityTag
      |> join(:inner, [tag], assignment in ArticleCommunityTag, on: assignment.tag_id == tag.id)
      |> join(:inner, [_tag, assignment], relation in ArticleCommunity,
        on: relation.id == assignment.article_community_id
      )
      |> where([_tag, _assignment, relation], relation.article_id == ^article.id)
      |> Repo.all()

    case TagStats.update_many(article, Enum.map(tags, &{&1, delta})) do
      {:ok, _result} -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp update_community_count(%Article{} = article) do
    with %Community{} = community <- Repo.get(Community, article.community_id),
         {:ok, _community} <- CMS.Communities.update_count_field(community, article.thread) do
      :ok
    else
      nil -> {:error, CMS.Articles.ErrorCat.article_not_found("community not found")}
      {:error, _reason} = error -> error
    end
  end

  defp resolve_item(%TrashedArticle{} = item), do: {:ok, Repo.preload(item, :trash_action)}
  defp resolve_item(hash_id), do: get(hash_id)

  defp get_doc_item(hash_id) do
    case Repo.get_by(TrashedDocArticle, hash_id: hash_id) do
      %TrashedDocArticle{} = item -> {:ok, Repo.preload(item, :trash_action)}
      nil -> {:error, CMS.Articles.ErrorCat.not_exist("TrashedArticle")}
    end
  end

  defp activity(article, action, actor, %TrashAction{} = trash_action, opts \\ []) do
    Activity.log(article, action,
      actor: activity_actor(actor),
      source: Keyword.get(opts, :source, :api),
      operation_ref: trash_action.hash_id,
      occurred_at: DateTime.utc_now(:second)
    )
  end

  defp activity_source(opts) do
    Activity.Const.normalize_source(Keyword.get(opts, :source, :api))
  end

  defp activity_actor(nil), do: :system
  defp activity_actor(:operations), do: :system
  defp activity_actor(actor), do: actor

  defp actor_id(%{id: id}) when is_integer(id), do: id
  defp actor_id(_actor), do: nil
  defp normalize_delete({:ok, _row}), do: :ok
  defp normalize_delete({:error, reason}), do: {:error, reason}
end
