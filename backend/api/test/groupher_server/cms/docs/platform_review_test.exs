defmodule GroupherServer.Test.CMS.Docs.PlatformReviewTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticlePublic, ArtimentReview}

  test "Doc release queues platform review for the published Snapshot" do
    {_community, doc, _attrs, _user} = mock_article(:doc)
    public = Repo.get!(ArticlePublic, doc.id)

    request =
      Repo.one!(
        from(request in ArtimentReview,
          where:
            request.target_type == :article and request.article_id == ^doc.id and
              is_nil(request.community_id)
        )
      )

    assert request.state == :queued
    assert request.policy_snapshot["scope"] == "system"
    assert Repo.get!(CMS.Model.ArticleSnapshot, public.snapshot_id).article_id == doc.id
    assert is_binary(request.payload["text"]["body"])

    assert {:ok, _} =
             CMS.FrontDesk.article(%{
               community: doc.community.slug,
               thread: :doc,
               inner_id: doc.inner_id
             })
  end
end
