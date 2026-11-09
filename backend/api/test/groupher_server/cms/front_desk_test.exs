defmodule GroupherServer.Test.CMS.FrontDeskTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS

  setup do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    {:ok, ~m(owner community)a}
  end

  test "community reads use the public policy by default", ~m(community)a do
    assert {:ok, loaded} = CMS.FrontDesk.community(community.slug)
    assert loaded.id == community.id
  end

  test "community reads accept an explicit management actor and mode", ~m(owner community)a do
    assert {:ok, loaded} = CMS.FrontDesk.community(community.slug, owner, mode: :management)
    assert loaded.id == community.id
  end

  test "community reads reject unsupported modes", ~m(owner community)a do
    assert {:error, %ErrorCat.Error{reason: :unknown_policy_mode}} =
             CMS.FrontDesk.community(community.slug, owner, mode: :test)
  end

  test "thread_of/1 does not infer a Doc thread from Article id alone" do
    assert {:error, %ErrorCat.Error{}} =
             CMS.FrontDesk.thread_of(%{article_id: Ecto.UUID.generate()})
  end

  test "articles/2 reads selected hidden Articles by stable ID without exposing them publicly" do
    {community, first, _, author} = mock_article(:post)
    {_community, second, _, _} = mock_article(:post, community, author)
    first_id = first.id
    second_id = second.id
    missing_id = Ecto.UUID.generate()

    assert {:ok, [one, two]} =
             CMS.FrontDesk.article([first_id, missing_id, second_id], mode: :internal)

    assert [one.id, two.id] == [first_id, second_id]

    assert {:ok, [one, duplicate]} =
             CMS.FrontDesk.article([first_id, first_id], mode: :internal)

    assert one.id == duplicate.id

    GroupherServer.Repo.insert!(%CMS.Model.ArticleReviewBlock{
      article_id: second_id,
      type: :human_review_hold,
      source: :request,
      source_ref: Ecto.UUID.generate(),
      applied_at: DateTime.utc_now(:second)
    })

    assert {:ok, [one, two]} = CMS.FrontDesk.article([first_id, second_id], mode: :internal)
    assert [one.id, two.id] == [first_id, second_id]

    first_binding =
      GroupherServer.Repo.get_by!(CMS.Model.ArticleBinding,
        article_id: first_id,
        community_id: community.id
      )

    second_binding =
      GroupherServer.Repo.get_by!(CMS.Model.ArticleBinding,
        article_id: second_id,
        community_id: community.id
      )

    first_path = %{
      community: community.slug,
      thread: :post,
      inner_id: first_binding.inner_id
    }

    second_path = %{first_path | inner_id: second_binding.inner_id}

    assert {:ok, [%{article: %{id: ^first_id}}]} =
             CMS.FrontDesk.article([first_path, second_path])

    assert {:error, %ErrorCat.Error{reason: :batch_limit_exceeded}} =
             CMS.FrontDesk.article(List.duplicate(first_path, 101))

    assert {:error, %ErrorCat.Error{reason: :batch_limit_exceeded}} =
             CMS.FrontDesk.article(List.duplicate(first_id, 101), mode: :internal)

    assert {:ok, []} = CMS.FrontDesk.article([], mode: :internal)

    assert {:error, %ErrorCat.Error{reason: :invalid_body}} =
             CMS.FrontDesk.article([first_id], mode: :unknown)
  end

  test "comments/2 resolves public paths and internal stable IDs in batches",
       ~m(owner community)a do
    {_community, article, _, _} = mock_article(:post, community, owner)

    binding =
      GroupherServer.Repo.get_by!(CMS.Model.ArticleBinding,
        article_id: article.id,
        community_id: community.id
      )

    {:ok, first} =
      CMS.Comments.create_comment(
        community,
        :post,
        binding.inner_id,
        mock_comment("First FrontDesk batch comment"),
        owner,
        Ecto.UUID.generate()
      )

    {:ok, second} =
      CMS.Comments.create_comment(
        community,
        :post,
        binding.inner_id,
        mock_comment("Second FrontDesk batch comment"),
        owner,
        Ecto.UUID.generate()
      )

    assert {:ok, [one, two]} =
             CMS.FrontDesk.comment([first.id, Ecto.UUID.generate(), second.id], mode: :internal)

    assert [one.comment.id, two.comment.id] == [first.id, second.id]

    assert {:ok, [one, duplicate]} =
             CMS.FrontDesk.comment([first.id, first.id], mode: :internal)

    assert one.comment.id == duplicate.comment.id

    path = %{
      article: %{community: community.slug, thread: :post, inner_id: binding.inner_id},
      inner_id: first.inner_id
    }

    assert {:ok, [%{comment: %{id: id}}]} = CMS.FrontDesk.comment([path])
    assert id == first.id
    assert {:ok, []} = CMS.FrontDesk.comment([], mode: :internal)

    assert {:error, %ErrorCat.Error{reason: :invalid_body}} =
             CMS.FrontDesk.comment(List.duplicate(first.id, 101), mode: :internal)
  end
end
