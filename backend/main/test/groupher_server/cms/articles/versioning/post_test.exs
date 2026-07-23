defmodule GroupherServer.Test.CMS.Articles.Versioning.Post do
  @moduledoc false

  use GroupherServer.TestMate

  @body_v1 Jason.encode!([
             %{"type" => "p", "children" => [%{"text" => "post version one content"}]}
           ])
  @body_v2 Jason.encode!([
             %{"type" => "p", "children" => [%{"text" => "post version two content"}]}
           ])
  @body_preview Jason.encode!([
                  %{"type" => "p", "children" => [%{"text" => "post preview content"}]}
                ])

  test "supports the complete Post Draft, Revision, Diff, Preview, and Publish lifecycle" do
    {community, _existing_post, attrs, user} = mock_article(:post)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :post,
        Map.merge(attrs, %{title: "Post version one", body_bag: mock_body_bag(@body_v1)}),
        user
      )

    assert draft.stage == :draft
    assert is_binary(draft.article_hash_id)

    {:ok, first} =
      CMS.Articles.checkpoint_draft(community, :post, draft.article_hash_id, user)

    {:ok, updated} =
      CMS.Articles.update_draft(
        community,
        :post,
        draft.article_hash_id,
        %{title: "Post version two", body_bag: mock_body_bag(@body_v2)},
        user
      )

    assert {:ok, %{changed: true, document_changed: true}} =
             CMS.Articles.diff_current(updated, first)

    assert {:ok, [only_revision]} =
             CMS.Articles.list_snapshots(community, :post, draft.article_hash_id)

    assert only_revision.hash_id == first.hash_id

    {:ok, second} =
      CMS.Articles.checkpoint_draft(community, :post, draft.article_hash_id, user)

    assert updated.title == "Post version two"
    assert {first.revision_number, second.revision_number} == {1, 2}
    assert CMS.Articles.diff_snapshots(first, second).document_changed

    {:ok, restored} =
      CMS.Articles.restore_snapshot(
        community,
        :post,
        draft.article_hash_id,
        first.hash_id,
        user
      )

    assert restored.title == "Post version one"

    {:ok, %{snapshot: published}} =
      CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

    assert published.action == :publish
    assert published.revision_number == 4

    {:ok, forked} =
      CMS.Articles.fork_preview(
        community,
        :post,
        draft.article_hash_id,
        %{slug: "post-preview", title: "Post Preview"},
        user
      )

    assert forked.branch.type == :preview
    assert forked.draft.stage == :draft
    assert forked.snapshot.action == :fork

    {:ok, _preview_draft} =
      CMS.Articles.update_draft(
        community,
        :post,
        draft.article_hash_id,
        %{
          branch_id: forked.branch.id,
          title: "Post preview promoted",
          body_bag: mock_body_bag(@body_preview)
        },
        user
      )

    {:ok, promoted} =
      CMS.Articles.promote_preview(
        community,
        :post,
        draft.article_hash_id,
        forked.branch,
        user
      )

    assert promoted.snapshot.action == :promote
    assert promoted.snapshot.revision_number == 5
    assert promoted.draft.title == "Post preview promoted"

    {:ok, public_before_publish} =
      CMS.Articles.read_public(community, :post, draft.article_hash_id)

    assert public_before_publish.title == "Post version one"

    {:ok, %{snapshot: final_public}} =
      CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

    assert final_public.revision_number == 6
    assert final_public.title == "Post preview promoted"

    assert {:error, _} =
             CMS.Articles.read_public(
               community,
               :post,
               draft.article_hash_id,
               branch_id: forked.branch.id
             )
  end

  test "rejects Preview promotion after main/public has changed" do
    {community, _existing_post, attrs, user} = mock_article(:post)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :post,
        Map.merge(attrs, %{title: "Post conflict base", body_bag: mock_body_bag(@body_v1)}),
        user
      )

    {:ok, _published} =
      CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

    {:ok, forked} =
      CMS.Articles.fork_preview(
        community,
        :post,
        draft.article_hash_id,
        %{slug: "post-conflict-preview", title: "Post Conflict Preview"},
        user
      )

    {:ok, _main_draft} =
      CMS.Articles.update_draft(
        community,
        :post,
        draft.article_hash_id,
        %{title: "Post main changed", body_bag: mock_body_bag(@body_v2)},
        user
      )

    {:ok, _republished} =
      CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

    assert {:error, {:conflict, "main/public changed after the Preview fork"}} =
             CMS.Articles.promote_preview(
               community,
               :post,
               draft.article_hash_id,
               forked.branch,
               user
             )
  end

  test "can fork a Preview from an explicitly selected historical Snapshot" do
    {community, _existing_post, attrs, user} = mock_article(:post)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :post,
        Map.merge(attrs, %{title: "Post selected history", body_bag: mock_body_bag(@body_v1)}),
        user
      )

    {:ok, selected_snapshot} =
      CMS.Articles.checkpoint_draft(community, :post, draft.article_hash_id, user)

    {:ok, _updated} =
      CMS.Articles.update_draft(
        community,
        :post,
        draft.article_hash_id,
        %{title: "Post current head", body_bag: mock_body_bag(@body_v2)},
        user
      )

    {:ok, _published} =
      CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

    {:ok, forked} =
      CMS.Articles.fork_preview(
        community,
        :post,
        draft.article_hash_id,
        %{
          slug: "post-selected-history",
          title: "Post Selected History",
          source_snapshot_hash_id: selected_snapshot.hash_id
        },
        user
      )

    assert forked.draft.title == "Post selected history"
    assert forked.snapshot.source_snapshot_id == selected_snapshot.id
  end
end
