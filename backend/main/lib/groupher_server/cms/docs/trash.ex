defmodule GroupherServer.CMS.Docs.Trash do
  @moduledoc """
  Branch-local Trash membership and lifecycle operations for Docs.

  Doc identity -> TrashAction membership -> restore or permanent deletion
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{Activity, CMS, Repo}
  alias GroupherServer.CMS.Docs.Lifecycle

  alias GroupherServer.CMS.Model.{
    ArticleDocument,
    Community,
    Doc,
    DocBranch,
    DocLifecycle,
    TrashAction,
    TrashedDocArticle
  }

  alias GroupherServer.CMS.Articles.Trash
  alias Helper.ORM

  @doc """
  Creates a TrashAction through the shared `Articles.Trash` boundary.

  ## Examples

      Trash.create_action(community, user, %{root_type: :doc, root_ref: hash_id})
      #=> {:ok, %TrashAction{}}

  """
  def create_action(community, actor, attrs),
    do: Trash.create_action(community, actor, attrs)

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
    Enum.reduce_while(Enum.uniq(doc_ids), {:ok, []}, fn article_hash_id, {:ok, items} ->
      case attach_one(action, community, branch, article_hash_id, actor, opts) do
        {:ok, item} -> {:cont, {:ok, [item | items]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  def attach(
        %TrashAction{} = action,
        %Community{} = community,
        %DocBranch{} = branch,
        article_hash_id,
        actor,
        opts \\ []
      ) do
    attach_one(action, community, branch, article_hash_id, actor, opts)
  end

  def restore_action_articles(
        %TrashAction{} = action,
        %Community{} = community,
        %DocBranch{} = branch,
        actor,
        opts \\ []
      ) do
    TrashedDocArticle
    |> where(
      [item],
      item.trash_action_id == ^action.id and item.branch_id == ^branch.id
    )
    |> order_by([item], asc: item.article_hash_id)
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

  def permanently_delete_action_articles(
        %TrashAction{} = action,
        %Community{} = community,
        %DocBranch{} = branch,
        actor,
        opts \\ []
      ) do
    TrashedDocArticle
    |> where(
      [item],
      item.trash_action_id == ^action.id and item.branch_id == ^branch.id
    )
    |> order_by([item], asc: item.article_hash_id)
    |> lock("FOR UPDATE")
    |> Repo.all()
    |> Enum.reduce_while({:ok, :done}, fn item, {:ok, :done} ->
      case permanently_delete(item, community, branch, actor, opts) do
        {:ok, :done} -> {:cont, {:ok, :done}}
        error -> {:halt, error}
      end
    end)
  end

  defp attach_one(action, community, branch, article_hash_id, actor, opts) do
    case Repo.get_by(TrashedDocArticle,
           community_id: community.id,
           branch_id: branch.id,
           article_hash_id: article_hash_id
         ) do
      %TrashedDocArticle{} = item ->
        {:ok, item}

      nil ->
        with {:ok, doc} <- representative_doc(community, branch, article_hash_id),
             {:ok, restore_state} <- restore_state(community, branch, article_hash_id),
             {:ok, item} <-
               ORM.create(TrashedDocArticle, %{
                 trash_action_id: action.id,
                 community_id: community.id,
                 branch_id: branch.id,
                 article_hash_id: article_hash_id,
                 restore_state: restore_state,
                 deleted_by_id: actor_id(actor),
                 deleted_at: action.deleted_at
               }),
             {:ok, _lifecycle} <-
               Lifecycle.transition(community.id, branch.id, article_hash_id, :deleted),
             {:ok, _activity} <-
               maybe_activity(:trashed, doc, actor, action, action.deleted_at, opts) do
          {:ok, item}
        end
    end
  end

  defp restore(%TrashedDocArticle{} = item, community, branch, actor, opts) do
    with {:ok, doc} <- representative_doc(community, branch, item.article_hash_id),
         {:ok, _canonical} <- CMS.Gate.access_check(actor, :restore, doc),
         {:ok, lifecycle} <-
           Lifecycle.transition(
             community.id,
             branch.id,
             item.article_hash_id,
             item.restore_state
           ),
         {:ok, _} <- Repo.delete(item),
         {:ok, action} <- load_action(item.trash_action_id),
         {:ok, _activity} <-
           maybe_activity(:restored, doc, actor, action, lifecycle.changed_at, opts) do
      {:ok, doc}
    end
  end

  defp permanently_delete(%TrashedDocArticle{} = item, community, branch, actor, opts) do
    with {:ok, doc} <- representative_doc(community, branch, item.article_hash_id),
         {:ok, docs} <- physical_docs(community, branch, item.article_hash_id),
         {:ok, lifecycle} <-
           Lifecycle.transition(community.id, branch.id, item.article_hash_id, :destroy),
         :ok <- purge_physical_docs(docs),
         {_, _} <-
           Repo.delete_all(
             from(lifecycle in DocLifecycle,
               where:
                 lifecycle.community_id == ^community.id and
                   lifecycle.branch_id == ^branch.id and
                   lifecycle.article_hash_id == ^item.article_hash_id
             )
           ),
         {:ok, _} <- Repo.delete(item),
         {:ok, action} <- load_action(item.trash_action_id),
         {:ok, _activity} <-
           maybe_activity(
             :permanently_deleted,
             doc,
             actor,
             action,
             lifecycle.changed_at,
             opts
           ) do
      {:ok, :done}
    end
  end

  defp physical_docs(%Community{} = community, %DocBranch{} = branch, article_hash_id) do
    docs =
      Doc
      |> where(
        [doc],
        doc.community_id == ^community.id and doc.branch_id == ^branch.id and
          doc.article_hash_id == ^article_hash_id
      )
      |> order_by([doc], asc: doc.id)
      |> Repo.all()

    if docs == [],
      do: {:error, CMS.Articles.ErrorCat.not_exist("physical Doc")},
      else: {:ok, docs}
  end

  defp purge_physical_docs(docs) do
    Enum.reduce_while(docs, :ok, fn doc, :ok ->
      with {:ok, _} <- CMS.ArtimentMentions.purge_article_comments(doc),
           {:ok, _} <- CMS.ArtimentMentions.purge(doc),
           {:ok, _} <- CMS.Assets.cleanup_refs(:doc, doc.id),
           {:ok, _} <- CMS.Covers.delete_cover_edit_info(doc.cover_edit_info_id),
           {_, _} <-
             Repo.delete_all(
               from(document in ArticleDocument,
                 where: document.thread == :doc and document.article_id == ^doc.id
               )
             ),
           {:ok, _} <- Repo.delete(doc) do
        {:cont, :ok}
      else
        error -> {:halt, error}
      end
    end)
  end

  defp representative_doc(community, branch, article_hash_id) do
    Doc
    |> where(
      [doc],
      doc.community_id == ^community.id and doc.branch_id == ^branch.id and
        doc.article_hash_id == ^article_hash_id
    )
    |> order_by([doc], desc: doc.stage)
    |> limit(1)
    |> Repo.one()
    |> case do
      %Doc{} = doc -> {:ok, doc}
      nil -> {:error, CMS.Articles.ErrorCat.not_exist("logical Doc")}
    end
  end

  defp restore_state(community, branch, article_hash_id) do
    case Lifecycle.state(community.id, branch.id, article_hash_id) do
      {:ok, :archived} ->
        {:error,
         GroupherServer.CMS.Articles.ErrorCat.archived("Doc is archived, can not be deleted")}

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
      nil -> {:error, GroupherServer.ErrorCat.custom("Trash action does not exist")}
    end
  end

  defp activity_source(opts) do
    case Keyword.get(opts, :source, :api) do
      source when source in [:api, :admin, :worker, :scheduler, :maintenance] -> source
      "api" -> :api
      "admin" -> :admin
      "worker" -> :worker
      "scheduler" -> :scheduler
      "maintenance" -> :maintenance
    end
  end

  defp actor_id(%User{id: id}), do: id
  defp actor_id(_), do: nil
end
