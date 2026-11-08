defmodule GroupherServer.Test.Query.CMS.ArticleActivityAcceptanceTest do
  @moduledoc "Exercises the public Activity HTTP contract without Doc Comment dependencies."
  use GroupherServer.TestMate, async: false

  @moduletag :b3_independent

  import Ecto.Query
  alias GroupherServer.{Activity, CMS, Repo}
  alias Activity.Model.PostLog

  @query """
  query ArticleActivityAcceptance($article: ArticlePathInput!, $pagi: PagiInput) {
    articleLogs(article: $article, pagi: $pagi) {
      entries { id action actor { type login nickname avatar } subject { type title innerId }
        target { type ref title innerId url } payload occurredAt }
      pageInfo { hasNextPage ... on CursorPageInfo { endCursor } }
    }
  }
  """

  setup do
    {community, post, _, user} = mock_article(:post)

    {:ok,
     %{
       community: community,
       post: post,
       user: user,
       conn: simu_conn(:guest),
       path: %{
         community: community.slug,
         thread: "POST",
         inner_id: article_inner_id(post, community)
       }
     }}
  end

  test "HTTP cursor pages traverse tied Activity times without duplicates", ctx do
    occurred_at = DateTime.utc_now(:second)

    for _ <- 1..3 do
      assert {:ok, _} =
               Activity.log(ctx.post, :restored, actor: ctx.user, occurred_at: occurred_at)
    end

    {:ok, expected} =
      Activity.list_article_logs(Map.put(ctx.post, :community, ctx.community), nil)

    first = gq_query(ctx.conn, @query, %{article: ctx.path, pagi: %{cursor: %{first: 2}}})
    assert first["pageInfo"]["hasNextPage"]

    second =
      gq_query(ctx.conn, @query, %{
        article: ctx.path,
        pagi: %{cursor: %{first: 2, after: first["pageInfo"]["endCursor"]}}
      })

    ids = Enum.map(first["entries"] ++ second["entries"], & &1["id"])
    assert ids == Enum.map(expected.entries, & &1.id)
    assert length(ids) == length(Enum.uniq(ids))
    refute second["pageInfo"]["hasNextPage"]
  end

  test "HTTP Activity excludes audit-only actions and strips private envelope fields", ctx do
    assert {:ok, _} = Activity.log(ctx.post, :trashed, actor: ctx.user)
    assert {:ok, _} = Activity.log(ctx.post, :permanently_deleted, actor: ctx.user)
    # Even an old stored envelope must pass the current projection allowlist.
    log = Repo.get_by!(PostLog, article_id: ctx.post.article_id, action: :created)

    log
    |> Ecto.Changeset.change(
      metadata: %{"revision_id" => "private-revision", "private_marker" => "never-public"}
    )
    |> Repo.update!()

    result = gq_query(ctx.conn, @query, %{article: ctx.path})
    assert Enum.any?(result["entries"], &(&1["action"] == "created"))
    refute Enum.any?(result["entries"], &(&1["action"] in ["trashed", "permanently_deleted"]))
    encoded = Jason.encode!(result)
    refute encoded =~ "never-public"
    refute encoded =~ "private-revision"

    assert Enum.all?(
             result["entries"],
             &(not Map.has_key?(&1, "metadata") and not Map.has_key?(&1, "source"))
           )
  end

  test "hidden root and unrelated Article cursor fail closed through HTTP", ctx do
    for _ <- 1..2, do: Activity.log(ctx.post, :restored, actor: ctx.user)
    page = gq_query(ctx.conn, @query, %{article: ctx.path, pagi: %{cursor: %{first: 1}}})
    {_, other, _, _} = mock_article(:post, ctx.community, ctx.user)

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(ctx.conn, @query, %{
        article: %{ctx.path | inner_id: article_inner_id(other, ctx.community)},
        pagi: %{cursor: %{first: 1, after: page["pageInfo"]["endCursor"]}}
      })
    end

    Repo.update_all(
      from(l in CMS.Model.ArticleLifecycle, where: l.article_id == ^ctx.post.article_id),
      set: [state: :draft]
    )

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(ctx.conn, @query, %{article: ctx.path})
    end
  end
end
