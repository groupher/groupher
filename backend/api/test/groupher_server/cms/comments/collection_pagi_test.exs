defmodule GroupherServer.Test.CMS.Comments.CollectionPagi do
  use GroupherServer.TestMate

  import Ecto.Query

  alias Helper.ORM.Pagi.{Page}
  alias GroupherServer.{CMS, Pagi, Repo}
  alias CMS.Model.{ArticleLifecycle, ArticleReviewBlock}
  alias Pagi.Params

  test "published and participant cursors agree with offset and bind their collection" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])
    authors = [actor | for(_ <- 1..3, do: elem(db_insert(:user), 1))]

    for author <- authors do
      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post, community),
          mock_comment(),
          author,
          Ecto.UUID.generate()
        )
    end

    assert {:ok, %Page.Offset{entries: expected, total_count: 4}} =
             CMS.Comments.paged_comments_participants(:post, post.id, %Params.Offset{
               page: 1,
               size: 100
             })

    assert {:ok, %Page.Cursor{entries: first, end_cursor: cursor}} =
             CMS.Comments.paged_comments_participants(:post, post.id, %Params.Cursor{first: 2})

    assert {:ok, %Page.Cursor{entries: rest, has_next_page: false}} =
             CMS.Comments.paged_comments_participants(:post, post.id, %Params.Cursor{
               first: 100,
               after: cursor
             })

    assert Enum.map(first ++ rest, & &1.id) == Enum.map(expected, & &1.id)

    assert {:error, _} =
             CMS.Comments.paged_published_comments(
               actor,
               nil,
               %{},
               %Params.Cursor{first: 2, after: cursor},
               nil
             )

    assert {:ok, %Page.Cursor{entries: [%{author_id: author_id}], has_next_page: false}} =
             CMS.Comments.paged_published_comments(actor, nil, %{}, %Params.Cursor{first: 2}, nil)

    assert author_id == actor.id
  end

  test "filters comments with restricted parents before calculating profile pages" do
    {hidden_community, hidden_article, _, _hidden_author} = mock_article(:post)
    {public_community, public_article, _, _public_author} = mock_article(:post)
    {:ok, commenter} = db_insert(:user)

    {:ok, _public_comment} =
      CMS.Comments.create_comment(
        public_community,
        :post,
        article_inner_id(public_article, public_community),
        mock_comment(),
        commenter,
        Ecto.UUID.generate()
      )

    {:ok, _hidden_comment} =
      CMS.Comments.create_comment(
        hidden_community,
        :post,
        article_inner_id(hidden_article, hidden_community),
        mock_comment(),
        commenter,
        Ecto.UUID.generate()
      )

    _lifecycle = Repo.get_by!(ArticleLifecycle, article_id: hidden_article.id)

    %ArticleReviewBlock{}
    |> ArticleReviewBlock.changeset(%{
      article_id: hidden_article.id,
      type: :awaiting_human,
      source_ref: "profile-parent-restricted",
      source: :request,
      applied_at: DateTime.utc_now(:second)
    })
    |> Repo.insert!()

    assert {:ok, %Page.Offset{entries: [entry], total_count: 1}} =
             CMS.Comments.paged_published_comments(
               commenter,
               nil,
               %{},
               %Params.Offset{page: 1, size: 1},
               nil
             )

    assert entry.article_id == public_article.id
  end
end
