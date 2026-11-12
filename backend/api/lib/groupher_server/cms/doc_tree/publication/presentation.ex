defmodule GroupherServer.CMS.DocTree.Publication.Presentation do
  @moduledoc """
  Projects current cover selections onto the version-bound preview tree.

      current Cover + settings -> authorized preview nodes -> cards, pins and links
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{CommunityDashboard, DocCoverCard, DocCoverPinnedDoc, DocsTreeNode}

  @doc "Reads cover selections in the caller's snapshot without legacy DocPublic lookups."
  def read(site, nodes, copies \\ %{}) do
    by_id = Map.new(nodes, &{&1.node_id, &1})

    cards =
      Repo.all(
        from(c in DocCoverCard,
          join: n in DocsTreeNode,
          on: n.id == c.group_node_id,
          where: c.community_id == ^site.id,
          order_by: c.index,
          select: %{node_id: n.node_id, appearance: c.appearance}
        )
      )

    pins =
      Repo.all(
        from(c in DocCoverPinnedDoc,
          join: n in DocsTreeNode,
          on: n.id == c.node_id,
          where: c.community_id == ^site.id,
          order_by: c.index,
          select: %{node_id: n.node_id, appearance: c.appearance}
        )
      )

    visible = fn entries -> Enum.filter(entries, &Map.has_key?(by_id, &1.node_id)) end
    dashboard = Repo.get_by(CommunityDashboard, community_id: site.id)

    ids = nodes |> Enum.map(& &1.doc_id) |> Enum.reject(&is_nil/1) |> Enum.uniq()

    documents =
      Repo.all(
        from(p in CMS.Model.ArticlePublic,
          join: b in CMS.Model.ArticlePublicBody,
          on: b.article_id == p.article_id,
          where: p.article_id in ^ids,
          select: {p.article_id, %{title: p.title, thumbnail: b.thumbnail}}
        )
      )
      |> Map.new()

    copy_ids = Enum.map(Map.values(copies), & &1.id)

    queued =
      Repo.all(
        from(w in CMS.Model.ArticleWorkingCopy,
          join: b in CMS.Model.ArticleBody,
          on: b.id == w.body_id,
          where: w.id in ^copy_ids and w.article_id in ^ids,
          select: {w.article_id, %{title: w.title, thumbnail: b.thumbnail}}
        )
      )
      |> Map.new()

    links =
      Repo.all(
        from(b in CMS.Model.ArticleBinding,
          join: p in CMS.Model.ArticlePublic,
          on: p.article_id == b.article_id,
          where: b.community_id == ^site.id and b.article_id in ^ids and not is_nil(b.inner_id),
          select: {b.article_id, b.inner_id, p.slug}
        )
      )
      |> Enum.flat_map(fn {id, inner, slug} ->
        [{"/#{site.slug}/doc/#{inner}", id}, {"/#{site.slug}/doc/#{inner}/#{slug}", id}]
      end)
      |> Map.new()

    %{
      documents: Map.merge(documents, queued),
      links: links,
      cards: visible.(cards),
      pinned_docs: visible.(pins),
      settings:
        if(dashboard,
          do: dashboard |> Map.take([:doc_faq, :layout, :enable]) |> json(),
          else: %{}
        )
    }
  end

  @doc "Serializes embedded presentation values without Ecto metadata."
  def json(%_{} = value), do: value |> Map.from_struct() |> Map.delete(:__meta__) |> json()
  def json(value) when is_map(value), do: Map.new(value, fn {k, v} -> {k, json(v)} end)
  def json(value) when is_list(value), do: Enum.map(value, &json/1)
  def json(value), do: value

  @doc "Runs a presentation write and advances its site version in the same transaction."
  def write(site, fun) do
    with {:ok, queue} <- CMS.DocTree.Publish.Queue.lock_or_create(site),
         {:ok, result} <- fun.(),
         {:ok, _} <-
           CMS.DocTree.Publish.Queue.advance(
             site,
             queue,
             %{public_presentation_revision: queue.public_presentation_revision},
             [:public_presentation_revision]
           ) do
      {:ok, result}
    end
  end
end
