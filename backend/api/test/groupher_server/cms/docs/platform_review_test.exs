defmodule GroupherServer.Test.CMS.Docs.PlatformReviewTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{CMS, Repo, ReviewBot}
  alias CMS.Articles.Draft.Store
  alias CMS.Model.{DocBranch, DocPublic, ArtimentReview}

  test "Doc publish queues a platform review for its branch" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Persist.ensure_author_exists(user)

    assert {:ok, %{system: config, community: nil}} = ReviewBot.configs(nil, :doc)
    assert is_nil(config.review_mode)

    branch =
      %DocBranch{}
      |> DocBranch.changeset(%{
        community_id: community.id,
        slug: "main",
        title: "Main",
        type: :main,
        status: :active,
        created_by_id: user.id
      })
      |> Repo.insert!()

    {:ok, %{article: article, draft: draft}} =
      Store.create(
        community,
        :doc,
        %{
          title: "Platform reviewed Doc",
          slug: "platform-reviewed-#{System.unique_integer([:positive])}",
          body_bag: mock_body_bag(mock_rich_text("Doc body"))
        },
        author,
        branch_id: branch.id
      )

    assert {:ok, result} =
             CMS.Articles.Publish.Doc.publish(article, branch.id, author,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1,
               command_id: Ecto.UUID.generate()
             )

    public = Repo.get_by!(DocPublic, article_id: article.id, branch_id: branch.id)

    request =
      Repo.one!(
        from(request in ArtimentReview,
          where:
            request.target_type == :doc and request.article_id == ^article.id and
              request.branch_id == ^branch.id and is_nil(request.community_id)
        )
      )

    assert request.state == :queued
    assert request.policy_snapshot["scope"] == "system"
    refute Map.has_key?(request.policy_snapshot, "review_mode")
    assert String.contains?(request.payload["text"]["body"], "Doc body")
    assert public.visible
    assert result.public.visible
  end
end
