defmodule GroupherServer.Test.CMS.Comments.CollectionPagi do
  use GroupherServer.TestMate

  import Ecto.Query

  alias Helper.ORM.Pagi.{Page}
  alias GroupherServer.{CMS, Pagi, Repo}
  alias CMS.Model.{ArticleBinding, ArticleLifecycle, ArticleReviewBlock, CommunityLifecycle}
  alias Pagi.Params

  test "mirrored parents keep one author comment, correct pages, and a readable URL context" do
    {source, post, _, actor} = mock_article(:post)
    {:ok, mirror} = db_insert(:community)

    comments =
      for _ <- 1..3 do
        {:ok, comment} =
          CMS.Comments.create_comment(
            source,
            :post,
            article_inner_id(post, source),
            mock_comment(),
            actor,
            Ecto.UUID.generate()
          )

        comment
      end

    Repo.insert!(
      ArticleBinding.changeset(%ArticleBinding{}, %{
        article_id: post.id,
        community_id: mirror.id,
        inner_id: 9001
      })
    )

    assert {:ok, %Page.Offset{entries: expected, total_count: 3}} =
             CMS.Comments.paged_published_comments(
               actor,
               nil,
               %{},
               %Params.Offset{page: 1, size: 100},
               nil
             )

    assert MapSet.new(Enum.map(expected, & &1.id)) == MapSet.new(Enum.map(comments, & &1.id))

    assert {:ok, %Page.Cursor{entries: first, end_cursor: cursor, has_next_page: true}} =
             CMS.Comments.paged_published_comments(actor, nil, %{}, %Params.Cursor{first: 1}, nil)

    assert {:ok, %Page.Cursor{entries: rest, has_next_page: false}} =
             CMS.Comments.paged_published_comments(
               actor,
               nil,
               %{},
               %Params.Cursor{first: 100, after: cursor},
               nil
             )

    assert Enum.map(first ++ rest, & &1.id) == Enum.map(expected, & &1.id)

    Repo.get_by!(CommunityLifecycle, community_id: source.id)
    |> CommunityLifecycle.changeset(%{state: :suspended})
    |> Repo.update!()

    assert {:ok, %Page.Offset{entries: surviving, total_count: 3}} =
             CMS.Comments.paged_published_comments(
               actor,
               nil,
               %{},
               %Params.Offset{page: 1, size: 100},
               nil
             )

    assert Enum.all?(
             surviving,
             &(&1.article.community.id == mirror.id and &1.article.inner_id == 9001)
           )

    query = """
    query($login: String!) {
      pagedPublishedComments(login: $login, pagi: {offset: {page: 1, size: 100}}) {
        entries { innerId article { innerId community { slug } } }
        pageInfo { ... on OffsetPageInfo { totalCount } }
      }
    }
    """

    result = gq_query(simu_conn(:guest), query, %{login: actor.login})
    assert result["pageInfo"]["totalCount"] == 3
    assert Enum.all?(result["entries"], &(&1["article"]["community"]["slug"] == mirror.slug))

    Repo.get_by!(CommunityLifecycle, community_id: mirror.id)
    |> CommunityLifecycle.changeset(%{state: :suspended})
    |> Repo.update!()

    assert {:ok, %Page.Offset{entries: [], total_count: 0}} =
             CMS.Comments.paged_published_comments(
               actor,
               nil,
               %{},
               %Params.Offset{page: 1, size: 100},
               nil
             )
  end

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
             CMS.Comments.paged_comments_participants(
               :post,
               post.id,
               %Params.Offset{
                 page: 1,
                 size: 100
               },
               community.slug
             )

    assert {:ok, %Page.Cursor{entries: first, end_cursor: cursor}} =
             CMS.Comments.paged_comments_participants(
               :post,
               post.id,
               %Params.Cursor{first: 2},
               community.slug
             )

    assert {:ok, %Page.Cursor{entries: rest, has_next_page: false}} =
             CMS.Comments.paged_comments_participants(
               :post,
               post.id,
               %Params.Cursor{
                 first: 100,
                 after: cursor
               },
               community.slug
             )

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
      type: :human_review_hold,
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
