defmodule GroupherServer.CMS.DocTree.WorkspaceDuplicate do
  @moduledoc """
  Duplicates an editable page or link into a new workspace identity.

      DuplicateWorkspaceNode -> checked source D or Public Snapshot -> new Article / D / node

  Source D is never created by copying a published page. Queue and Public remain unchanged.
  """
  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.{DefaultCopy, WorkspacePersist}
  alias CMS.DocTree.Publish.{ContentState, Queue, TreeOrder}
  alias CMS.Model.ArticleSnapshot
  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Copies one checked source and its complete content in the caller's transaction."
  def run(site, queue, revision, node_id, actor, operation_ref) do
    with {:ok, queue} <- Queue.advance(site, queue, %{tree_lock_version: revision}, []),
         rows <- WorkspacePersist.lock_nodes(site),
         %{type: type} = source <- Enum.find(rows, &(&1.node_id == node_id)),
         true <- type in [:page, :link],
         title <- copy_title(source, rows),
         {:ok, content} <- copy_content(site, source, title, actor),
         node <-
           source
           |> Map.take(@fields)
           |> Map.merge(%{
             node_id: Ecto.UUID.generate(),
             title: title,
             doc_id: content.article_id
           }),
         {:ok, result} <-
           TreeOrder.insert(Enum.map(rows, &Map.take(&1, @fields)), node, source.index + 1),
         {:ok, :pass} <- WorkspacePersist.save(site, rows, result.changed),
         {:ok, queue} <-
           Queue.advance(
             site,
             queue,
             %{tree_lock_version: revision},
             [:tree_lock_version],
             operation_ref
           ) do
      {:ok,
       %{
         node_id: node.node_id,
         article_id: node.doc_id,
         working_copy_id: content.working_copy_id,
         tree_revision: queue.tree_lock_version
       }}
    else
      {:error, _} = error -> error
      _ -> {:error, :invalid_tree_input}
    end
  end

  defp copy_content(_site, %{type: :link}, _title, _actor) do
    {:ok, %{article_id: nil, working_copy_id: nil}}
  end

  defp copy_content(site, %{doc_id: id}, title, actor) do
    with {:ok, :pass} <- CMS.DocTree.Commands.QueueAccess.authorize(site, id, actor),
         {:ok, state} <- DefaultCopy.load(site, id),
         true <- state.lifecycle.state in [:draft, :published],
         source <- state.work || Repo.get!(ArticleSnapshot, state.public.snapshot_id),
         {:ok, content} <- ContentState.load(source),
         attrs <-
           content
           |> Map.take(
             ~w(digest subtitle link_addr template_key cover_url cover_url_dark cover_edit)a
           )
           |> Map.merge(%{title: title, tag_ids: content.tags, asset_refs: content.asset_refs}),
         {:ok, created} <-
           CMS.Docs.Content.create_workspace(site, attrs, actor, {source, content.cover_refs}) do
      {:ok, %{article_id: created.article.id, working_copy_id: created.working_copy.id}}
    else
      false -> {:error, :invalid_doc_lifecycle}
      {:error, _} = error -> error
    end
  end

  defp copy_title(source, rows) do
    titles =
      rows |> Enum.filter(&(&1.parent_node_id == source.parent_node_id)) |> MapSet.new(& &1.title)

    Stream.iterate(1, &(&1 + 1))
    |> Enum.find_value(fn number ->
      suffix = if number == 1, do: " copy", else: " copy #{number}"
      title = String.slice(source.title, 0, 100 - String.length(suffix)) <> suffix
      if not MapSet.member?(titles, title), do: title
    end)
  end
end
