defmodule GroupherServer.CMS.DocTree.WorkspaceRead do
  @moduledoc """
  Reads the branch-free working tree with authorized default-copy identities.

      Docs workspace query -> Gate / WorkspaceRead -> working tree and default identities
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Queue, SiteLock}

  alias CMS.Model.{
    Article,
    ArticlePublic,
    ArticleWorkingCopy,
    Community,
    DocsLifecycle,
    DocsTreeNode
  }

  @doc "Reads a consistent workspace without creating an empty site's Queue."
  def read(%Community{} = community, %User{} = actor) do
    Repo.transact(fn ->
      with {:ok, community} <- CMS.Gate.Access.Check.community(actor, :manage_docs, community),
           {:ok, :acquired} <- SiteLock.acquire(community),
           {:ok, queue} <- Queue.read(community),
           {:ok, nodes} <- nodes(community, actor) do
        {:ok,
         %{
           tree_revision: queue.tree_lock_version,
           queue_revision: queue.queue_revision,
           nodes: nodes
         }}
      end
    end)
  end

  def read(_, _), do: {:error, :invalid_docs_workspace_reader}

  defp nodes(community, actor) do
    rows =
      Repo.all(
        from(n in DocsTreeNode,
          where: n.community_id == ^community.id and n.stage == :draft,
          order_by: [n.parent_node_id, n.index, n.node_id]
        )
      )

    ids = rows |> Enum.filter(&(&1.type == :page)) |> Enum.map(& &1.doc_id) |> Enum.sort()

    works =
      Repo.all(
        from(l in DocsLifecycle,
          left_join: w in ArticleWorkingCopy,
          on: w.id == l.default_working_copy_id and w.article_id == l.article_id,
          where:
            l.community_id == ^community.id and l.article_id in ^ids and
              l.state not in [:deleted, :destroy],
          select: {l.article_id, w.id, w.revision}
        )
      )
      |> Map.new(fn {article_id, id, revision} ->
        {article_id, %{working_copy_id: id, working_copy_revision: revision}}
      end)

    published =
      Repo.all(from(p in ArticlePublic, where: p.article_id in ^ids, select: p.article_id))
      |> MapSet.new()

    blocked =
      (Repo.all(
         from(m in CMS.Model.DocsQueueArticle, where: m.article_id in ^ids, select: m.article_id)
       ) ++
         Repo.all(
           from(c in CMS.Model.DocsPostPublishConflict,
             where: c.article_id in ^ids,
             select: c.article_id
           )
         ))
      |> MapSet.new()

    valid_defaults =
      Enum.all?(works, fn {id, work} ->
        not is_nil(work.working_copy_id) or
          (MapSet.member?(published, id) and not MapSet.member?(blocked, id))
      end)

    with true <- map_size(works) == length(ids) and valid_defaults,
         {:ok, :pass} <- authorize(community, ids, actor) do
      {:ok,
       Enum.map(rows, fn row ->
         row
         |> Map.take(~w(node_id type parent_node_id index title href doc_id marker badge hidden)a)
         |> Map.put(:published, MapSet.member?(published, row.doc_id))
         |> Map.merge(
           Map.get(works, row.doc_id, %{working_copy_id: nil, working_copy_revision: nil})
         )
       end)}
    else
      false -> {:error, :invalid_doc_lifecycle}
      {:error, _reason} = error -> error
    end
  end

  defp authorize(community, ids, actor) do
    articles = Repo.all(from(a in Article, where: a.id in ^ids, order_by: a.id))

    if length(articles) != length(ids) do
      {:error, :invalid_doc_identity}
    else
      Enum.reduce_while(articles, {:ok, :pass}, fn article, _ ->
        case CMS.Gate.Access.Check.with_authorized_article_binding(
               actor,
               :edit,
               {community, article},
               fn _ -> {:ok, :pass} end
             ) do
          {:ok, :pass} -> {:cont, {:ok, :pass}}
          {:error, _reason} = error -> {:halt, error}
        end
      end)
    end
  end
end
