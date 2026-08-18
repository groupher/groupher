defmodule GroupherServer.Test.CMS.Articles.Versioning.Post do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Articles.DraftDiff
  alias CMS.Model.Post

  test "DraftDiff includes every Post version field" do
    public = %Post{
      stage: :public,
      title: "Public",
      digest: "digest",
      link_addr: "https://example.com/public",
      copy_right: "original",
      cover_url: "https://example.com/cover.png"
    }

    draft = %{
      public
      | stage: :draft,
        copy_right: "updated",
        cover_url: "https://example.com/new-cover.png"
    }

    assert %{changed: true, fields: fields} = DraftDiff.compare(draft, public)
    assert fields.copy_right == %{before: "original", after: "updated"}

    assert fields.cover_url == %{
             before: "https://example.com/cover.png",
             after: "https://example.com/new-cover.png"
           }
  end

  test "keeps an ordinary Post draft until explicit publish" do
    {community, public, attrs, user} = mock_article(:post)

    {:ok, draft} =
      CMS.Articles.update_draft(
        community,
        :post,
        public.article_hash_id,
        %{
          title: "Post draft",
          body_bag: mock_body_bag(mock_rich_text("draft")),
          expected_version: public.version
        },
        user
      )

    assert draft.stage == :draft
    refute Map.has_key?(draft, :branch_id)

    assert {:ok, unchanged_public} =
             CMS.Articles.read_public(community, :post, public.article_hash_id)

    assert unchanged_public.title == public.title

    assert {:ok, _authorized_draft} =
             CMS.Articles.read_draft(community, :post, public.article_hash_id, actor: user)

    {:ok, other_user} = db_insert(:user)

    assert {:error, _} =
             CMS.Articles.read_draft(community, :post, public.article_hash_id, actor: other_user)

    assert {:ok, true} =
             CMS.Articles.has_unpublished_changes(community, :post, public.article_hash_id)

    {:ok, %{article: republished, snapshot: nil}} =
      CMS.Articles.publish_draft(community, :post, public.article_hash_id, user)

    assert republished.title == "Post draft"
    assert {:error, _} = CMS.Articles.read_draft(community, :post, public.article_hash_id)

    assert {:ok, false} =
             CMS.Articles.has_unpublished_changes(community, :post, public.article_hash_id)

    _ = attrs
  end

  test "DraftDiff reports no change when the current Post has no Draft" do
    {community, public, _attrs, _user} = mock_article(:post)

    assert {:ok, %{changed: false, document_changed: false, fields: %{}}} =
             CMS.Articles.draft_diff(community, :post, public.article_hash_id)
  end
end
