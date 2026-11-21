defmodule GroupherServer.Test.CMS.Gate.G1SurfaceConsistencyTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS
  alias CMS.Comments.Lifecycle

  alias CMS.Model.{
    ArticleBinding,
    ArticlePublic,
    ArticleReviewBlock,
    CommunityAdmin,
    CommunityLifecycle,
    GlobalPassport
  }

  test "public Article detail, list, and count consume the same Gate visibility" do
    {community, article, _attrs, author} = mock_article(:post)
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)
    path = %{community: community.slug, thread: :post, inner_id: binding.inner_id}
    pagi = %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0}

    assert {:ok, _} = CMS.FrontDesk.article(path, author)

    assert {:ok, %{entries: [entry], page_info: %{total_count: 1}}} =
             CMS.Articles.Pagination.page(:post, %{community: community.slug}, pagi, author)

    assert entry.id == article.id
    assert {:ok, [%CMS.Model.Article{id: article_id}]} = CMS.FrontDesk.article([path])
    assert article_id == article.id

    restriction =
      Repo.insert!(%ArticleReviewBlock{
        article_id: article.id,
        community_id: community.id,
        type: :ai_suspect_hold,
        source_ref: "test-rule",
        source: :request,
        applied_at: DateTime.utc_now(:second)
      })

    assert {:ok, _} = CMS.FrontDesk.article(path, author)

    {:ok, community_reader_user} = db_insert(:user)

    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{
        user_id: community_reader_user.id,
        community_id: community.id,
        permissions: %{"review.read" => true}
      })
    )

    assert {:ok, reviewer_article} = CMS.FrontDesk.article(path, community_reader_user)
    assert reviewer_article.id == article.id

    {:ok, platform_reader_user} = db_insert(:user)

    Repo.insert!(
      GlobalPassport.changeset(%GlobalPassport{}, %{
        user_id: platform_reader_user.id,
        permissions: %{"review.platform.read" => true}
      })
    )

    assert {:ok, platform_reviewer_article} =
             CMS.FrontDesk.article(path, platform_reader_user)

    assert platform_reviewer_article.id == article.id

    assert {:ok, %{entries: [entry], page_info: %{total_count: 1}}} =
             CMS.Articles.Pagination.page(:post, %{community: community.slug}, pagi, author)

    assert entry.id == article.id
    assert {:ok, []} = CMS.FrontDesk.article([path])
    assert {:error, %ErrorCat.Error{reason: :article_not_found}} = CMS.FrontDesk.article(path)

    assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
             CMS.Articles.Pagination.page(:post, %{community: community.slug}, pagi)

    Repo.delete!(restriction)

    assert {:ok, _} = CMS.FrontDesk.article(path, author)

    assert {:ok, %{entries: [entry], page_info: %{total_count: 1}}} =
             CMS.Articles.Pagination.page(:post, %{community: community.slug}, pagi, author)

    assert entry.id == article.id
    assert {:ok, [%CMS.Model.Article{id: article_id}]} = CMS.FrontDesk.article([path])
    assert article_id == article.id

    Repo.delete!(Repo.get_by!(ArticlePublic, article_id: article.id))

    assert {:error, %ErrorCat.Error{reason: :article_not_found}} =
             CMS.FrontDesk.article(path, author)

    assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
             CMS.Articles.Pagination.page(:post, %{community: community.slug}, pagi, author)

    Repo.update_all(from(row in CommunityLifecycle, where: row.community_id == ^community.id),
      set: [state: :suspended]
    )

    assert {:error, %ErrorCat.Error{}} = CMS.FrontDesk.article(path, author)

    assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
             CMS.Articles.Pagination.page(:post, %{community: community.slug}, pagi, author)
  end

  test "Doc public detail and list hide an actively restricted Doc" do
    {community, article, _attrs, author} = mock_article(:doc)
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)
    path = %{community: community.slug, thread: :doc, inner_id: binding.inner_id}

    pagi = %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0}

    assert {:ok, _} = CMS.FrontDesk.article(path, author)

    assert {:ok, %{entries: [entry], page_info: %{total_count: 1}}} =
             CMS.Articles.Pagination.page(:doc, %{community: community.slug}, pagi, author)

    assert entry.id == article.id

    assert {:ok, [%CMS.Model.Article{id: article_id}]} = CMS.FrontDesk.article([path])
    assert article_id == article.id

    Repo.insert!(%CMS.Model.ArticleReviewBlock{
      article_id: article.id,
      type: :ai_suspect_hold,
      source_ref: "test-rule",
      source: :request,
      applied_at: DateTime.utc_now(:second)
    })

    assert {:ok, _} = CMS.FrontDesk.article(path, author)

    assert {:ok, %{entries: [entry], page_info: %{total_count: 1}}} =
             CMS.Articles.Pagination.page(:doc, %{community: community.slug}, pagi, author)

    assert entry.id == article.id
    assert {:ok, []} = CMS.FrontDesk.article([path])
    assert {:error, %ErrorCat.Error{reason: :article_not_found}} = CMS.FrontDesk.article(path)

    assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
             CMS.Articles.Pagination.page(:doc, %{community: community.slug}, pagi)
  end

  test "public Comment detail retains the Gate destroy tombstone exclusion" do
    {community, article, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment(),
        author,
        Ecto.UUID.generate()
      )

    path = %{
      article: %{
        community: community.slug,
        thread: :post,
        inner_id: article_inner_id(article, community)
      },
      inner_id: comment.inner_id
    }

    assert {:ok, loaded} = CMS.FrontDesk.comment(path)
    assert loaded.id == comment.id

    assert {:ok, _} = Lifecycle.transition(comment.id, :destroy, Ecto.UUID.generate())
    assert {:error, %ErrorCat.Error{reason: :not_exist}} = CMS.FrontDesk.comment(path)
  end
end
