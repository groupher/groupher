defmodule GroupherServer.Test.CMS.Articles.Versioning.Doc do
  @moduledoc false

  use GroupherServer.TestMate

  @body_v1 Jason.encode!([
             %{"type" => "p", "children" => [%{"text" => "doc version one content"}]}
           ])
  @body_v2 Jason.encode!([
             %{"type" => "p", "children" => [%{"text" => "doc version two content"}]}
           ])
  @body_preview Jason.encode!([
                  %{"type" => "p", "children" => [%{"text" => "doc preview content"}]}
                ])

  test "supports the complete Doc Draft, Revision, Diff, Preview, and Publish lifecycle" do
    {community, _existing_doc, attrs, user} = mock_article(:doc)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :doc,
        Map.merge(attrs, %{title: "Doc version one", body_bag: mock_body_bag(@body_v1)}),
        user
      )

    assert draft.stage == :draft
    assert is_binary(draft.article_hash_id)

    {:ok, first} =
      CMS.Articles.checkpoint_draft(community, :doc, draft.article_hash_id, user)

    {:ok, updated} =
      CMS.Articles.update_draft(
        community,
        :doc,
        draft.article_hash_id,
        %{title: "Doc version two", body_bag: mock_body_bag(@body_v2)},
        user
      )

    assert {:ok, %{changed: true, document_changed: true}} =
             CMS.Articles.diff_current(updated, first)

    assert {:ok, [only_revision]} =
             CMS.Articles.list_snapshots(community, :doc, draft.article_hash_id)

    assert only_revision.hash_id == first.hash_id

    {:ok, second} =
      CMS.Articles.checkpoint_draft(community, :doc, draft.article_hash_id, user)

    assert updated.title == "Doc version two"
    assert {first.revision_number, second.revision_number} == {1, 2}
    assert CMS.Articles.diff_snapshots(first, second).document_changed

    {:ok, restored} =
      CMS.Articles.restore_snapshot(
        community,
        :doc,
        draft.article_hash_id,
        first.hash_id,
        user
      )

    assert restored.title == "Doc version one"

    {:ok, %{snapshot: published}} =
      CMS.Articles.publish_draft(community, :doc, draft.article_hash_id, user)

    assert published.action == :publish
    assert published.revision_number == 4

    {:ok, forked} =
      CMS.Articles.fork_preview(
        community,
        :doc,
        draft.article_hash_id,
        %{slug: "doc-preview", title: "Doc Preview"},
        user
      )

    assert forked.branch.type == :preview
    assert forked.draft.stage == :draft
    assert forked.snapshot.action == :fork

    {:ok, _preview_draft} =
      CMS.Articles.update_draft(
        community,
        :doc,
        draft.article_hash_id,
        %{
          branch_id: forked.branch.id,
          title: "Doc preview promoted",
          body_bag: mock_body_bag(@body_preview)
        },
        user
      )

    {:ok, promoted} =
      CMS.Articles.promote_preview(
        community,
        :doc,
        draft.article_hash_id,
        forked.branch,
        user
      )

    assert promoted.snapshot.action == :promote
    assert promoted.snapshot.revision_number == 5
    assert promoted.draft.title == "Doc preview promoted"

    {:ok, public_before_publish} =
      CMS.Articles.read_public(community, :doc, draft.article_hash_id)

    assert public_before_publish.title == "Doc version one"

    {:ok, %{snapshot: final_public}} =
      CMS.Articles.publish_draft(community, :doc, draft.article_hash_id, user)

    assert final_public.revision_number == 6
    assert final_public.title == "Doc preview promoted"

    assert {:error, _} =
             CMS.Articles.read_public(
               community,
               :doc,
               draft.article_hash_id,
               branch_id: forked.branch.id
             )
  end
end
