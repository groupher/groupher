defmodule GroupherServer.Test.CMS.Articles.Versioning.Blog do
  @moduledoc false

  use GroupherServer.TestMate

  test "keeps an ordinary Blog draft until explicit publish" do
    {community, public, _attrs, user} = mock_article(:blog)

    {:ok, draft} =
      CMS.Articles.update_draft(
        community,
        :blog,
        public.article_hash_id,
        %{title: "Blog draft", expected_version: public.version},
        user
      )

    assert draft.stage == :draft
    refute Map.has_key?(draft, :branch_id)
    assert {:ok, public_again} = CMS.Articles.read_public(community, :blog, public.article_hash_id)
    assert public_again.title == public.title

    {:ok, %{article: published, snapshot: nil}} =
      CMS.Articles.publish_draft(community, :blog, public.article_hash_id, user)

    assert published.title == "Blog draft"
    assert {:error, _} = CMS.Articles.read_draft(community, :blog, public.article_hash_id)
  end
end
