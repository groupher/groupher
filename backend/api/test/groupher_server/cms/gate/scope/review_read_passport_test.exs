defmodule GroupherServer.Test.CMS.Gate.Scope.ReviewReadPassportTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Gate.Context.Scope.{Comment, Doc}
  alias CMS.Model.{ArticleReviewBlock, CommentReviewBlock, CommunityAdmin, GlobalPassport}

  test "public Article and Comment scopes use current Community Passport grants" do
    {community_a, article_a, _, author_a} = mock_article(:doc)
    {community_b, article_b, _, author_b} = mock_article(:doc)
    {:ok, reader} = db_insert(:user)

    {:ok, comment_a} =
      CMS.Comments.create_comment(
        community_a,
        :doc,
        article_inner_id(article_a, community_a),
        mock_comment("restricted A"),
        author_a,
        Ecto.UUID.generate()
      )

    {:ok, comment_b} =
      CMS.Comments.create_comment(
        community_b,
        :doc,
        article_inner_id(article_b, community_b),
        mock_comment("restricted B"),
        author_b,
        Ecto.UUID.generate()
      )

    for {article, comment, community} <- [
          {article_a, comment_a, community_a},
          {article_b, comment_b, community_b}
        ] do
      Repo.insert!(%ArticleReviewBlock{
        article_id: article.id,
        community_id: community.id,
        type: :ai_suspect_hold,
        source_ref: "review-read-#{community.id}",
        source: :request,
        applied_at: DateTime.utc_now(:second)
      })

      Repo.insert!(%CommentReviewBlock{
        comment_id: comment.id,
        community_id: community.id,
        type: :ai_suspect_hold,
        source_ref: "comment-review-read-#{community.id}",
        source: :request,
        applied_at: DateTime.utc_now(:second)
      })
    end

    {:ok, root_reader} = db_insert(:user)

    Repo.insert!(
      GlobalPassport.changeset(%GlobalPassport{}, %{
        user_id: root_reader.id,
        is_root: true,
        permissions: %{}
      })
    )

    assert article_visible?(root_reader, article_a, community_a)
    assert comment_visible?(root_reader, comment_a, community_a)

    stale_reader =
      Map.put(reader, :cur_passport, %{
        "global" => %{},
        community_a.slug => %{"cms" => %{"review.read" => true}}
      })

    grant_review_read(stale_reader, community_b)

    assert article_visible?(stale_reader, article_a, community_a) == false
    assert comment_visible?(stale_reader, comment_a, community_a) == false
    assert article_visible?(stale_reader, article_b, community_b)
    assert comment_visible?(stale_reader, comment_b, community_b)

    community_a_grant = grant_review_read(stale_reader, community_a)

    assert article_visible?(stale_reader, article_a, community_a)
    assert comment_visible?(stale_reader, comment_a, community_a)

    Repo.delete!(community_a_grant)

    assert article_visible?(stale_reader, article_a, community_a) == false
    assert comment_visible?(stale_reader, comment_a, community_a) == false
  end

  test "query review predicates fail closed for malformed Passport rows including lord and root" do
    {community, article, _, author} = mock_article(:doc)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :doc,
        article_inner_id(article, community),
        mock_comment("restricted"),
        author,
        Ecto.UUID.generate()
      )

    Repo.insert!(%ArticleReviewBlock{
      article_id: article.id,
      community_id: community.id,
      type: :ai_suspect_hold,
      source_ref: "malformed-review-read-#{community.id}",
      source: :request,
      applied_at: DateTime.utc_now(:second)
    })

    Repo.insert!(%CommentReviewBlock{
      comment_id: comment.id,
      community_id: community.id,
      type: :ai_suspect_hold,
      source_ref: "malformed-comment-review-read-#{community.id}",
      source: :request,
      applied_at: DateTime.utc_now(:second)
    })

    malformed_community_permissions = [
      %{"review.read" => true, "unknown.permission" => true},
      %{"review.read" => true, "review.platform.read" => true},
      %{"review.read" => true, "admin.invite" => true},
      %{"review.read" => true, "article.move" => true},
      %{"review.read" => "true"}
    ]

    for permissions <- malformed_community_permissions do
      {:ok, malformed_reader} = db_insert(:user)

      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          user_id: malformed_reader.id,
          community_id: community.id,
          permissions: permissions
        })
      )

      assert article_visible?(malformed_reader, article, community) == false
      assert comment_visible?(malformed_reader, comment, community) == false
    end

    {:ok, malformed_lord} = db_insert(:user)

    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{
        user_id: malformed_lord.id,
        community_id: community.id,
        is_lord: true,
        permissions: %{"review.read" => "true"}
      })
    )

    assert article_visible?(malformed_lord, article, community) == false
    assert comment_visible?(malformed_lord, comment, community) == false

    {:ok, malformed_root} = db_insert(:user)

    Repo.insert!(
      GlobalPassport.changeset(%GlobalPassport{}, %{
        user_id: malformed_root.id,
        is_root: true,
        permissions: %{"review.platform.read" => "true"}
      })
    )

    assert article_visible?(malformed_root, article, community) == false
    assert comment_visible?(malformed_root, comment, community) == false
  end

  defp grant_review_read(actor, community) do
    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{
        user_id: actor.id,
        community_id: community.id,
        permissions: %{"review.read" => true}
      })
    )
  end

  defp article_visible?(actor, article, community) do
    query =
      CMS.Model.Article
      |> CMS.Gate.scope(actor, :read, Doc.public())
      |> where([row, ...], row.id == ^article.id)
      |> where([gate_community: row], row.id == ^community.id)

    Repo.exists?(query)
  end

  defp comment_visible?(actor, comment, community) do
    query =
      CMS.Model.Comment
      |> CMS.Gate.scope(actor, :list, Comment.for_thread(:doc, community_id: community.id))
      |> where([row], row.id == ^comment.id)

    Repo.exists?(query)
  end
end
