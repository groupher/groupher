defmodule GroupherServer.Test.CMS.Gate.G1SurfaceConsistencyTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS
  alias CMS.Comments.Lifecycle

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    ArticleReviewBlock,
    CommunityLifecycle,
    DocBranch
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
    assert {:ok, [%{article: %{id: article_id}}]} = CMS.Articles.locators([path])
    assert article_id == article.id

    restriction =
      Repo.insert!(%ArticleReviewBlock{
        article_id: article.id,
        community_id: community.id,
        type: :ai_suspect,
        source_ref: "test-rule",
        source: :request,
        subject_ref: Ecto.UUID.generate(),
        applied_at: DateTime.utc_now(:second)
      })

    assert {:ok, _} = CMS.FrontDesk.article(path, author)

    {:ok, community_reader_user} = db_insert(:user)

    community_reader = %{
      community_reader_user
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.read" => true}}
        }
    }

    assert {:ok, reviewer_article} = CMS.FrontDesk.article(path, community_reader)
    assert reviewer_article.article_id == article.id

    {:ok, platform_reader_user} = db_insert(:user)

    platform_reader = %{
      platform_reader_user
      | cur_passport: %{"global" => %{"review.platform.read" => true}}
    }

    assert {:error, %ErrorCat.Error{reason: :article_not_found}} =
             CMS.FrontDesk.article(path, platform_reader)

    assert {:ok, %{entries: [entry], page_info: %{total_count: 1}}} =
             CMS.Articles.Pagination.page(:post, %{community: community.slug}, pagi, author)

    assert entry.id == article.id
    assert {:ok, []} = CMS.Articles.locators([path])
    assert {:error, %ErrorCat.Error{reason: :article_not_found}} = CMS.FrontDesk.article(path)

    assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
             CMS.Articles.Pagination.page(:post, %{community: community.slug}, pagi)

    Repo.delete!(restriction)

    assert {:ok, _} = CMS.FrontDesk.article(path, author)

    assert {:ok, %{entries: [entry], page_info: %{total_count: 1}}} =
             CMS.Articles.Pagination.page(:post, %{community: community.slug}, pagi, author)

    assert entry.id == article.id
    assert {:ok, [%{article: %{id: article_id}}]} = CMS.Articles.locators([path])
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

  test "Doc public detail and list hide an actively restricted main branch" do
    {community, article, _attrs, author} = mock_article(:doc)
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)
    path = %{community: community.slug, thread: :doc, inner_id: binding.inner_id}

    branch = Repo.get_by!(DocBranch, community_id: community.id, type: :main)
    pagi = %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0}

    assert {:ok, _} = CMS.FrontDesk.article(path, author)

    assert {:ok, %{entries: [entry], page_info: %{total_count: 1}}} =
             CMS.Articles.Pagination.page(:doc, %{community: community.slug}, pagi, author)

    assert entry.id == article.id

    assert {:ok, [%{article: %{id: article_id}}]} = CMS.Articles.locators([path])
    assert article_id == article.id

    Repo.insert!(%CMS.Model.DocReviewBlock{
      article_id: article.id,
      branch_id: branch.id,
      type: :ai_suspect,
      source_ref: "test-rule",
      source: :request,
      subject_ref: Ecto.UUID.generate(),
      applied_at: DateTime.utc_now(:second)
    })

    assert {:ok, _} = CMS.FrontDesk.article(path, author)

    assert {:ok, %{entries: [entry], page_info: %{total_count: 1}}} =
             CMS.Articles.Pagination.page(:doc, %{community: community.slug}, pagi, author)

    assert entry.id == article.id
    assert {:ok, []} = CMS.Articles.locators([path])
    assert {:error, %ErrorCat.Error{reason: :article_not_found}} = CMS.FrontDesk.article(path)

    assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
             CMS.Articles.Pagination.page(:doc, %{community: community.slug}, pagi)

    preview =
      %DocBranch{}
      |> DocBranch.changeset(%{
        community_id: community.id,
        slug: "preview",
        title: "Preview",
        type: :preview,
        status: :active
      })
      |> Repo.insert!()

    assert %Ecto.Query{} =
             non_main_scope =
             CMS.Gate.scope(
               Article,
               author,
               :read,
               CMS.Gate.Context.Scope.Doc.public_branch(preview.id)
             )

    refute Repo.exists?(non_main_scope)
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

    assert {:ok, _} = Lifecycle.transition(comment.id, :destroy)
    assert {:error, %ErrorCat.Error{reason: :not_exist}} = CMS.FrontDesk.comment(path)
  end
end
