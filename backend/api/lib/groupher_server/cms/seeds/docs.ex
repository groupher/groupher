defmodule GroupherServer.CMS.Seeds.Docs do
  @moduledoc """
  Seeds Docs through workspace, queue and release commands using the current model.

      seed transaction -> workspace page / D -> Q -> complete Release -> Public

  A nonempty Queue is rejected so a seed cannot publish somebody else's work.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Commands.{BeginEdit, CreateWorkspaceNode, Enqueue, ReleaseQueue}
  alias CMS.DocTree.Publish.{Queue, SiteLock}

  alias CMS.Model.{
    Article,
    ArticlePublic,
    ArticleWorkingCopy,
    DocsTreeNode,
    DocsQueueArticle,
    DocsQueueTreeChange
  }

  @doc "Creates and publishes one seed page under the current Docs commands."
  def create(community, attrs, actor, command_id) do
    attrs = content_attrs(attrs)

    Repo.transact(fn ->
      with {:ok, :acquired} <- SiteLock.acquire(community),
           {:ok, queue} <- Queue.lock_or_create(community),
           {:ok, :pass} <- empty_queue(community),
           {:ok, parent} <- parent(community, queue, actor),
           {:ok, queue} <- Queue.read(community),
           {:ok, page} <-
             CreateWorkspaceNode.execute(
               community,
               queue.tree_lock_version,
               %{type: :page, title: Map.fetch!(attrs, :title), parent_node_id: parent},
               actor,
               Ecto.UUID.generate()
             ),
           article = Repo.get!(Article, page.article_id),
           {:ok, work} <-
             CMS.Articles.Commands.SaveWorkingCopy.execute(
               article,
               community,
               page.working_copy_id,
               attrs,
               1,
               actor,
               Ecto.UUID.generate()
             ),
           {:ok, public} <- publish(community, article, work, actor, command_id) do
        {:ok, public}
      end
    end)
  end

  @doc "Edits and publishes a seed Doc against its current Public Snapshot."
  def update(community, article_id, attrs, actor, command_id) do
    attrs = content_attrs(attrs)

    Repo.transact(fn ->
      with {:ok, :acquired} <- SiteLock.acquire(community),
           {:ok, _queue} <- Queue.lock_or_create(community),
           {:ok, :pass} <- empty_queue(community),
           public = Repo.get!(ArticlePublic, article_id),
           {:ok, edit} <-
             BeginEdit.execute(
               community,
               article_id,
               public.snapshot_id,
               actor,
               Ecto.UUID.generate()
             ),
           work = Repo.get!(ArticleWorkingCopy, edit.working_copy_id),
           article = Repo.get!(Article, article_id),
           {:ok, work} <-
             CMS.Articles.Commands.SaveWorkingCopy.execute(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               actor,
               Ecto.UUID.generate()
             ) do
        publish(community, article, work, actor, command_id)
      end
    end)
  end

  @doc "Removes a seed page from Public and Trash while retaining community history."
  def delete(community, article_id, actor) do
    Repo.transact(fn ->
      with {:ok, :acquired} <- SiteLock.acquire(community),
           {:ok, queue} <- Queue.lock_or_create(community),
           {:ok, :pass} <- empty_queue(community),
           node =
             Repo.one!(
               from(n in DocsTreeNode,
                 where:
                   n.community_id == ^community.id and
                     n.stage == :draft and n.doc_id == ^article_id
               )
             ),
           {:ok, deleted} <-
             CMS.DocTree.Commands.DeleteWorkspaceNode.execute(
               community,
               queue.tree_lock_version,
               queue.queue_revision,
               node.node_id,
               nil,
               actor,
               Ecto.UUID.generate()
             ),
           {:ok, _release} <-
             ReleaseQueue.execute(community, deleted.queue_revision, actor, Ecto.UUID.generate()),
           {:ok, queue} <- Queue.read(community) do
        CMS.DocTree.Commands.PurgeWorkspaceTrash.execute(
          community,
          queue.queue_revision,
          deleted.trash_action_id,
          actor,
          Ecto.UUID.generate()
        )
      end
    end)
  end

  defp content_attrs(attrs) do
    Map.take(attrs, [:title, :slug, :digest, :body_bag, :cover, :cover_edit, :tag_ids])
  end

  defp empty_queue(community) do
    if Repo.exists?(
         from(q in DocsQueueArticle,
           join: queue in CMS.Model.DocsPublishQueue,
           on: queue.id == q.queue_id,
           where: queue.community_id == ^community.id
         )
       ) or
         Repo.exists?(from(q in DocsQueueTreeChange, where: q.community_id == ^community.id)) do
      {:error, :seed_requires_empty_docs_queue}
    else
      {:ok, :pass}
    end
  end

  defp parent(community, queue, actor) do
    case Repo.one(
           from(n in DocsTreeNode,
             where:
               n.community_id == ^community.id and
                 n.stage == :draft and n.type == :group,
             order_by: n.node_id,
             limit: 1
           )
         ) do
      nil ->
        with {:ok, tab} <-
               CreateWorkspaceNode.execute(
                 community,
                 queue.tree_lock_version,
                 %{type: :tab, title: "Docs"},
                 actor,
                 Ecto.UUID.generate()
               ),
             {:ok, group} <-
               CreateWorkspaceNode.execute(
                 community,
                 tab.tree_revision,
                 %{type: :group, title: "Guides", parent_node_id: tab.node_id},
                 actor,
                 Ecto.UUID.generate()
               ) do
          {:ok, group.node_id}
        end

      node ->
        {:ok, node.node_id}
    end
  end

  defp publish(community, article, work, actor, command_id) do
    with {:ok, queue} <- Queue.read(community),
         {:ok, queued} <-
           Enqueue.execute(
             community,
             queue.queue_revision,
             [%{article_id: article.id, default_revision: work.revision}],
             actor,
             Ecto.UUID.generate()
           ),
         {:ok, _release} <-
           ReleaseQueue.execute(community, queued.queue_revision, actor, command_id),
         {:ok, binding} <- CMS.Articles.Bindings.fetch_binding(article.id, community.id) do
      CMS.FrontDesk.article(%{
        community: community.slug,
        thread: :doc,
        inner_id: binding.inner_id
      })
    end
  end
end
