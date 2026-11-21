defmodule GroupherServer.CMS.Articles.Query.PublicReadReport do
  @moduledoc """
  Reports Doc public projection damage and stale published-count projections.

      operator / tests -> independent integrity reads + canonical Doc Scope -> report only

  Integrity checks deliberately do not use Scope: damaged projections
  may be excluded from that collection. Snapshot/extension failures can still
  occur after admission; these checks do not broaden the Scope predicate.
  This is a full-database scan, intended for an isolated copy or replica.

  Community expectations mirror Communities.Count.update/2 (including Trash);
  author expectations mirror Articles.Query.count_published/2 (Binding rows).
  Keep these formulas aligned when changing either production counter.
  No body content is returned,
  no counts are repaired, and no history is used to replace a missing body.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Gate.Context.Scope.Doc, as: DocContext

  alias CMS.Model.{
    Article,
    ArticlePublic,
    ArticlePublicBody,
    ArticleSnapshot,
    ArticleSnapshotDoc,
    Author,
    Community
  }

  @doc "Returns integrity findings and the community/user count refresh manifest without writing."
  @spec report() :: {:ok, map()}
  def report do
    {:ok,
     %{
       projection_issues: projection_issues(),
       community_counts: community_counts(),
       author_counts: author_counts()
     }}
  end

  defp projection_issues do
    missing_or_mismatched =
      from(public in ArticlePublic,
        join: article in Article,
        on: article.id == public.article_id and article.thread == :doc,
        left_join: body in ArticlePublicBody,
        on: body.article_id == public.article_id,
        where: is_nil(body.article_id) or body.snapshot_id != public.snapshot_id,
        order_by: public.article_id,
        select: %{
          article_id: public.article_id,
          expected_snapshot_id: public.snapshot_id,
          actual_snapshot_id: body.snapshot_id
        }
      )
      |> Repo.all(log: false)
      |> Enum.map(fn row ->
        Map.put(
          row,
          :issue,
          if(is_nil(row.actual_snapshot_id), do: :body_missing, else: :snapshot_mismatch)
        )
      end)

    orphaned =
      from(body in ArticlePublicBody,
        join: article in Article,
        on: article.id == body.article_id and article.thread == :doc,
        left_join: public in ArticlePublic,
        on: public.article_id == body.article_id,
        where: is_nil(public.article_id),
        order_by: body.article_id,
        select: %{
          article_id: body.article_id,
          expected_snapshot_id: nil,
          actual_snapshot_id: body.snapshot_id,
          issue: :public_missing
        }
      )
      |> Repo.all(log: false)

    missing_or_mismatched ++ orphaned ++ snapshot_issues()
  end

  defp snapshot_issues do
    # Match Public.current's owner pair, not just the globally unique Snapshot ID.
    # A missing Snapshot is prevented by current FKs, but legacy damaged copies
    # may lack them. Do not misclassify its absent extension as a second issue.
    from(public in ArticlePublic,
      join: article in Article,
      on: article.id == public.article_id and article.thread == :doc,
      left_join: snapshot in ArticleSnapshot,
      on: snapshot.article_id == public.article_id and snapshot.id == public.snapshot_id,
      left_join: extension in ArticleSnapshotDoc,
      on: extension.snapshot_id == snapshot.id,
      where: is_nil(snapshot.id) or is_nil(extension.snapshot_id),
      order_by: public.article_id,
      select: %{
        article_id: public.article_id,
        expected_snapshot_id: public.snapshot_id,
        actual_snapshot_id: snapshot.id
      }
    )
    |> Repo.all(log: false)
    |> Enum.map(fn row ->
      issue = if is_nil(row.actual_snapshot_id), do: :snapshot_missing, else: :extension_missing
      Map.put(row, :issue, issue)
    end)
  end

  defp community_counts do
    expected =
      Article
      |> CMS.Articles.Trash.not_trashed_scope(:doc)
      |> CMS.Gate.scope(nil, :list, DocContext.public())
      |> group_by([gate_community: community], community.id)
      |> select([article, gate_community: community], {community.id, count(article.id)})
      |> Repo.all(log: false)
      |> Map.new()

    from(community in Community,
      order_by: community.id,
      select: {community.id, community.slug, community.meta}
    )
    |> Repo.all(log: false)
    |> Enum.flat_map(fn {id, slug, meta} ->
      stored = Map.get(meta || %{}, :docs_count, 0) || 0
      current = Map.get(expected, id, 0)

      if stored == current do
        []
      else
        [%{community_id: id, community: slug, stored: stored, expected: current}]
      end
    end)
  end

  defp author_counts do
    expected =
      public_docs()
      |> join(:inner, [article], author in Author, on: author.id == article.author_id)
      |> group_by([_article, ..., author], author.user_id)
      |> select([article, ..., author], {author.user_id, count(article.id)})
      |> Repo.all(log: false)
      |> Map.new()

    from(user in User, order_by: user.id, select: {user.id, user.meta})
    |> Repo.all(log: false)
    |> Enum.flat_map(fn {id, meta} ->
      stored = Map.get(meta || %{}, :published_docs_count, 0) || 0
      current = Map.get(expected, id, 0)
      if stored == current, do: [], else: [%{user_id: id, stored: stored, expected: current}]
    end)
  end

  defp public_docs, do: CMS.Gate.scope(Article, nil, :list, DocContext.public())
end
