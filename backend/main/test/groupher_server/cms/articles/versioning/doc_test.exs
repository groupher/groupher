defmodule GroupherServer.Test.CMS.Articles.Versioning.Doc do
  @moduledoc false

  use GroupherServer.TestMate

  test "keeps Doc snapshots and branch-local publication in the Docs boundary" do
    {community, public, _attrs, user} = mock_article(:doc)

    {:ok, draft} =
      CMS.Articles.update_draft(
        community,
        :doc,
        public.article_hash_id,
        %{title: "Doc draft", expected_version: public.version},
        user
      )

    assert draft.branch_id
    {:ok, first} = CMS.Docs.checkpoint_snapshot(community, draft.article_hash_id, user)

    assert first.action == :checkpoint
    assert {:ok, listed} = CMS.Docs.list_snapshots(community, draft.article_hash_id)
    assert Enum.any?(listed, &(&1.id == first.id))

    {:ok, %{article: published, snapshot: publish_snapshot}} =
      CMS.Articles.Publish.publish(
        community,
        :doc,
        public.article_hash_id,
        user,
        branch_id: draft.branch_id
      )

    assert published.stage == :public
    assert publish_snapshot.action == :publish
    assert {:error, _} = CMS.Articles.read_draft(community, :doc, public.article_hash_id)
  end
end
