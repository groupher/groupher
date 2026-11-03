defmodule GroupherServer.CMS.Comments.PageProjection do
  @moduledoc """
  Builds bounded Comment pages from canonical rows. Reply previews are a batch
  projection of each root's descendants, never the persisted embedded snapshot.
  Parent identity and root identity remain separate for future tree views.

  Business position:

      Comment collection query
        -> bounded root/reply page
        -> PageProjection batch counts and previews
        -> viewer-aware response
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Comment
  alias CMS.Gate.Context.Scope.Comment, as: CommentContext
  alias CMS.Comments.InteractionResponse

  @preview_size 3

  @doc "Scopes the flat descendant collection independently of its paging method."
  def descendants(article_id, root_ids, thread, viewer, community_slug \\ nil) do
    Comment
    |> CMS.Gate.scope(viewer, :list, context(thread))
    |> scope_community(community_slug)
    |> where([c], c.article_id == ^article_id and not c.is_folded)
    |> where(
      [c],
      fragment("COALESCE(?, ?)", c.root_comment_id, c.reply_to_comment_id) in ^root_ids
    )
  end

  @doc "Hydrates entries and optional root previews with a constant number of batch queries."
  def many(entries, article, viewer, previews?, community_slug \\ nil) do
    roots = Enum.filter(entries, &is_nil(&1.reply_to_comment_id))
    ids = Enum.map(roots, & &1.id)
    {previews, counts} = preview_batch(article, ids, viewer, previews?, community_slug)

    entries =
      Enum.map(entries, fn entry ->
        entry
        |> Map.put(:replies, Map.get(previews, entry.id, []))
        |> Map.put(:replies_count, Map.get(counts, entry.id, 0))
      end)

    all = Enum.flat_map(entries, &[&1 | &1.replies])

    parent_ids =
      all |> Enum.map(& &1.reply_to_comment_id) |> Enum.reject(&is_nil/1) |> Enum.uniq()

    parents =
      Comment
      |> CMS.Gate.scope(viewer, :list, context(article.thread))
      |> scope_community(community_slug)
      |> where([c], c.article_id == ^article.id and c.id in ^parent_ids and not c.is_folded)
      |> preload([:body, :author])
      |> Repo.all()
      |> Map.new(fn c -> {c.id, %{c | replies: [], reply_to_comment: nil}} end)

    root_ids = all |> Enum.map(& &1.root_comment_id) |> Enum.reject(&is_nil/1) |> Enum.uniq()

    root_refs =
      Comment
      |> where([c], c.article_id == ^article.id and c.id in ^root_ids)
      |> select([c], {c.id, c.inner_id})
      |> Repo.all()
      |> Map.new()

    entries = Repo.preload(entries, [:body, :author])

    entries =
      Enum.map(entries, fn entry ->
        entry
        |> Map.put(:root_inner_id, Map.get(root_refs, entry.root_comment_id, entry.inner_id))
        |> Map.put(:reply_to_comment, Map.get(parents, entry.reply_to_comment_id))
        |> Map.update!(:replies, fn replies ->
          Enum.map(replies, fn reply ->
            reply
            |> Map.put(:root_inner_id, entry.inner_id)
            |> Map.put(:reply_to_comment, Map.get(parents, reply.reply_to_comment_id))
          end)
        end)
      end)

    InteractionResponse.many(entries, viewer)
  end

  defp preview_batch(_article, [], _viewer, _enabled, _community_slug), do: {%{}, %{}}

  defp preview_batch(article, ids, viewer, enabled, community_slug) do
    base = descendants(article.id, ids, article.thread, viewer, community_slug)

    counts =
      base
      |> group_by([c], fragment("COALESCE(?, ?)", c.root_comment_id, c.reply_to_comment_id))
      |> select(
        [c],
        {fragment("COALESCE(?, ?)", c.root_comment_id, c.reply_to_comment_id), count(c.id)}
      )
      |> Repo.all()
      |> Map.new()

    if enabled do
      ranked =
        base
        |> windows([c],
          root: [
            partition_by: fragment("COALESCE(?, ?)", c.root_comment_id, c.reply_to_comment_id),
            order_by: [asc: c.inserted_at, asc: c.id]
          ]
        )
        |> select([c], %{
          id: c.id,
          root_id: fragment("COALESCE(?, ?)", c.root_comment_id, c.reply_to_comment_id),
          rank: over(row_number(), :root)
        })

      previews =
        from(c in Comment,
          join: ranked in subquery(ranked),
          on: c.id == ranked.id,
          where: ranked.rank <= ^@preview_size,
          order_by: [asc: c.inserted_at, asc: c.id],
          select: {ranked.root_id, c},
          preload: [:body, :author]
        )
        |> Repo.all()
        |> Enum.group_by(&elem(&1, 0), fn {_root, c} -> %{c | replies: []} end)

      {previews, counts}
    else
      {%{}, counts}
    end
  end

  defp context(:doc), do: CommentContext.for_thread(:doc, branch_policy: :main)
  defp context(thread), do: CommentContext.for_thread(thread)

  defp scope_community(query, nil), do: query

  defp scope_community(query, slug) when is_binary(slug) do
    where(query, [gate_community: community], community.slug == ^slug)
  end
end
