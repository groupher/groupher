defmodule GroupherServer.Test.CMS.Articles.Versioning.DraftVersion do
  @moduledoc false

  use GroupherServer.TestMate

  test "Draft.update uses an optimistic version guard" do
    {community, _existing_post, attrs, user} = mock_article(:post)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :post,
        Map.merge(attrs, %{
          title: "Versioned draft",
          body_bag: mock_body_bag(mock_rich_text("v1"))
        }),
        user
      )

    assert draft.version == 1

    {:ok, updated} =
      CMS.Articles.update_draft(
        community,
        :post,
        draft.article_hash_id,
        %{title: "Versioned draft v2", expected_version: draft.version},
        user
      )

    assert updated.version == 2

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :draft_conflict}} =
             CMS.Articles.update_draft(
               community,
               :post,
               draft.article_hash_id,
               %{title: "Stale write", expected_version: draft.version},
               user
             )
  end

  test "Draft.update rejects a missing expected version" do
    {community, _existing_post, attrs, user} = mock_article(:post)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :post,
        Map.merge(attrs, %{
          title: "Version required",
          body_bag: mock_body_bag(mock_rich_text("v1"))
        }),
        user
      )

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :draft_version_required}} =
             CMS.Articles.update_draft(
               community,
               :post,
               draft.article_hash_id,
               %{title: "Missing token"},
               user
             )
  end
end
