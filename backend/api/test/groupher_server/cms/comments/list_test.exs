defmodule GroupherServer.Test.CMS.Comments.QueryList do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.ArticleStats

  test "REPAIR-01 participant reads never enqueue repairs or overwrite the summary" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])

    assert {:ok, _comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(post, community),
               mock_comment(),
               actor,
               Ecto.UUID.generate()
             )

    stats = Repo.get_by!(ArticleStats, article_id: post.article_id, thread: :post)

    assert {:ok, _stats} =
             stats
             |> Ecto.Changeset.change(comments_participants_count: 99)
             |> Repo.update()

    assert {:ok, page} =
             CMS.Comments.paged_comments_participants(
               :post,
               post.id,
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20},
               community.slug
             )

    assert page.total_count == 1
    assert [%{id: actor_id}] = page.entries
    assert actor_id == actor.id

    assert Repo.get_by!(ArticleStats,
             article_id: post.article_id,
             thread: :post
           ).comments_participants_count == 99

    refute function_exported?(GroupherServer.Jobs, :reconcile_comments_participants, 3)
    refute function_exported?(CMS.ArticleStats, :rebuild_comment_fields, 1)
  end
end
