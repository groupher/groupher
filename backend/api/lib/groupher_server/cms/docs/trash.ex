defmodule GroupherServer.CMS.Docs.Trash do
  @moduledoc """
  Branch-local Trash membership and lifecycle operations for Docs.

  Doc identity -> TrashAction membership -> restore or permanent deletion
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias CMS.{Articles, ErrorCat}
  alias Accounts.Model.User
  alias CMS.Docs.Lifecycle
  alias CMS.Articles.Trash

  alias CMS.Model.{
    Article,
    Community,
    DocBranchState,
    DocBranchVersion,
    DocDraft,
    DocBranch,
    DocLifecycle,
    DocPublic,
    TrashAction,
    TrashedDocArticle,
    TrashedDocTreeNode
  }

  alias Helper.ORM

  @doc """
  Creates a TrashAction through the shared `Articles.Trash` boundary.

  ## Examples

      Trash.create_action(community, user, %{root_type: :doc, root_ref: hash_id})
      #=> {:ok, %TrashAction{}}

  """
  def create_action(community, actor, attrs) do
    Trash.create_action(community, actor, attrs)
  end

  @doc """
  Attaches many docs to one trash action inside a branch.

  Each unique entry in `doc_ids` becomes a `TrashedDocArticle` row and moves
  the branch lifecycle to `:deleted`. The first failure stops the batch.

  ## Examples

      Trash.attach_many(action, community, branch, [hash_1, hash_2], user)
      #=> {:ok, [%TrashedDocArticle{}, ...]}

  """
  def attach_many(
        %TrashAction{} = action,
        %Community{} = community,
        %DocBranch{} = branch,
        doc_ids,
        actor,
        opts \\ []
      ) do
    Enum.reduce_while(Enum.uniq(doc_ids), {:ok, []}, fn article_id, {:ok, items} ->
      case attach_one(action, community, branch, article_id, actor, opts) do
        {:ok, item} -> {:cont, {:ok, [item | items]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  @doc "Attaches one stable Doc Article to a branch-local Trash action."
  def attach(
        %TrashAction{} = action,
        %Community{} = community,
        %DocBranch{} = branch,
        article_id,
        actor,
        opts \\ []
      ) do
    attach_one(action, community, branch, article_id, actor, opts)
  end

  @doc "Restores every stable Doc Article membership owned by one Trash action."
  def restore_action_articles(
        %TrashAction{} = action,
        %Community{} = community,
        %DocBranch{} = branch,
        actor,
        opts \\ []
      ) do
    opts = Keyword.put(opts, :group_action, true)

    TrashedDocArticle
    |> where(
      [item],
      item.trash_action_id == ^action.id and item.branch_id == ^branch.id
    )
    |> order_by([item], asc: item.article_id)
    |> lock("FOR UPDATE")
    |> Repo.all()
    |> Enum.reduce_while({:ok, []}, fn item, {:ok, docs} ->
      case restore(item, community, branch, actor, opts) do
        {:ok, doc} -> {:cont, {:ok, [doc | docs]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, docs} -> {:ok, Enum.reverse(docs)}
      error -> error
    end
  end

  @doc "Permanently deletes every branch-local Doc membership owned by one Trash action."
  def permanently_delete_action_articles(
        %TrashAction{} = action,
        %Community{} = community,
        %DocBranch{} = branch,
        actor,
        opts \\ []
      ) do
    opts = Keyword.put(opts, :group_action, true)

    TrashedDocArticle
    |> where(
      [item],
      item.trash_action_id == ^action.id and item.branch_id == ^branch.id
    )
    |> order_by([item], asc: item.article_id)
    |> lock("FOR UPDATE")
    |> Repo.all()
    |> Enum.reduce_while({:ok, :done}, fn item, {:ok, :done} ->
      case permanently_delete(item, community, branch, actor, opts) do
        {:ok, :done} -> {:cont, {:ok, :done}}
        error -> {:halt, error}
      end
    end)
  end

  defp attach_one(action, community, branch, article_id, actor, opts) do
    case Repo.get_by(TrashedDocArticle,
           community_id: community.id,
           branch_id: branch.id,
           article_id: article_id
         ) do
      %TrashedDocArticle{} = item ->
        {:ok, item}

      nil ->
        with {:ok, doc} <- representative_doc(community, branch, article_id),
             {:ok, restore_state} <- restore_state(branch, article_id),
             {:ok, item} <-
               ORM.create(TrashedDocArticle, %{
                 trash_action_id: action.id,
                 community_id: community.id,
                 branch_id: branch.id,
                 article_id: article_id,
                 restore_state: restore_state,
                 deleted_by_id: actor_id(actor),
                 deleted_at: action.deleted_at
               }),
             {:ok, _lifecycle} <-
               Lifecycle.transition(article_id, branch.id, :deleted),
             {:ok, _activity} <-
               maybe_activity(:trashed, doc, actor, action, action.deleted_at, opts) do
          {:ok, item}
        end
    end
  end

  @doc "Restores one branch-scoped Doc Trash membership."
  @spec restore(TrashedDocArticle.t(), Community.t(), DocBranch.t(), term(), keyword()) ::
          {:ok, Article.t()} | {:error, term()}
  def restore(%TrashedDocArticle{} = item, community, branch, actor, opts) do
    with {:ok, _} <- ensure_group_action(item, opts),
         {:ok, article} <- representative_doc(community, branch, item.article_id) do
      CMS.Gate.with_branch_check(
        actor,
        :restore,
        community,
        article,
        branch.id,
        fn canonical ->
          with {:ok, lifecycle} <-
                 Lifecycle.transition(item.article_id, branch.id, item.restore_state),
               {:ok, _} <- Repo.delete(item),
               {:ok, action} <- load_action(item.trash_action_id),
               {:ok, _activity} <-
                 maybe_activity(:restored, canonical, actor, action, lifecycle.changed_at, opts) do
            {:ok, canonical}
          end
        end
      )
    end
  end

  @doc "Permanently deletes one branch-scoped Doc aggregate membership."
  @spec permanently_delete(
          TrashedDocArticle.t(),
          Community.t(),
          DocBranch.t(),
          term(),
          keyword()
        ) :: {:ok, :done} | {:error, term()}
  def permanently_delete(%TrashedDocArticle{} = item, community, branch, actor, opts) do
    with {:ok, _} <- ensure_group_action(item, opts),
         {:ok, article} <- representative_doc(community, branch, item.article_id) do
      CMS.Gate.with_branch_check(
        actor,
        :permanently_delete,
        community,
        article,
        branch.id,
        fn canonical ->
          with {:ok, lifecycle} <- Lifecycle.transition(item.article_id, branch.id, :destroy),
               {:ok, _} <- purge_branch(canonical, branch),
               {:ok, _} <- Repo.delete(item),
               {:ok, action} <- load_action(item.trash_action_id),
               {:ok, _activity} <-
                 maybe_activity(
                   :permanently_deleted,
                   canonical,
                   actor,
                   action,
                   lifecycle.changed_at,
                   opts
                 ) do
            {:ok, :done}
          end
        end
      )
    end
  end

  defp purge_branch(%Article{id: article_id} = article, %DocBranch{id: branch_id}) do
    Repo.delete_all(
      from(row in DocDraft, where: row.article_id == ^article_id and row.branch_id == ^branch_id)
    )

    Repo.delete_all(
      from(row in DocPublic, where: row.article_id == ^article_id and row.branch_id == ^branch_id)
    )

    Repo.delete_all(
      from(row in DocBranchVersion,
        where: row.article_id == ^article_id and row.branch_id == ^branch_id
      )
    )

    Repo.delete_all(
      from(row in DocBranchState,
        where: row.article_id == ^article_id and row.branch_id == ^branch_id
      )
    )

    Repo.delete_all(
      from(row in DocLifecycle,
        where: row.article_id == ^article_id and row.branch_id == ^branch_id
      )
    )

    if Repo.exists?(from(row in DocLifecycle, where: row.article_id == ^article_id)) do
      {:ok, :pass}
    else
      case Repo.delete(article) do
        {:ok, _article} -> {:ok, :pass}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp ensure_group_action(%TrashedDocArticle{trash_action_id: action_id}, opts) do
    grouped? =
      Repo.exists?(from(item in TrashedDocTreeNode, where: item.trash_action_id == ^action_id))

    if grouped? and not Keyword.get(opts, :group_action, false) do
      {:error, ErrorCat.custom("Trash action must be restored as one group")}
    else
      {:ok, :pass}
    end
  end

  defp representative_doc(%Community{} = community, branch, article_id) do
    with %Article{thread: :doc} = article <- Repo.get(Article, article_id),
         %CMS.Model.ArticleBinding{} <-
           Repo.get_by(CMS.Model.ArticleBinding,
             article_id: article_id,
             community_id: community.id
           ),
         {:ok, _state} <- Lifecycle.state(article_id, branch.id) do
      {:ok, Repo.preload(article, author: :user)}
    else
      _ -> {:error, CMS.Articles.ErrorCat.not_exist("stable Doc")}
    end
  end

  defp restore_state(branch, article_id) do
    case Lifecycle.state(article_id, branch.id) do
      {:ok, :archived} ->
        {:error, Articles.ErrorCat.archived("Doc is archived, can not be deleted")}

      {:ok, state} ->
        {:ok, state}

      error ->
        error
    end
  end

  defp maybe_activity(action, doc, actor, %TrashAction{} = trash_action, occurred_at, opts) do
    if Keyword.get(opts, :audit, true) do
      Activity.log(doc, action,
        actor: actor,
        operation_ref: trash_action.hash_id,
        source: activity_source(opts),
        occurred_at: occurred_at
      )
    else
      {:ok, :skipped}
    end
  end

  defp load_action(action_id) do
    case Repo.get(TrashAction, action_id) do
      %TrashAction{} = trash_action -> {:ok, trash_action}
      nil -> {:error, ErrorCat.custom("Trash action does not exist")}
    end
  end

  defp activity_source(opts) do
    opts |> Keyword.get(:source, :api) |> Activity.Const.normalize_source()
  end

  defp actor_id(%User{id: id}), do: id
  defp actor_id(_), do: nil
end
