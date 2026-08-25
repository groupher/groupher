defmodule GroupherServer.Test.CMS.Articles.VersionedRelations do
  @moduledoc false

  use GroupherServer.TestMate

  test "ordinary Article relations are copied from Draft to Public on publish" do
    for thread <- [:post, :blog, :changelog] do
      assert_tag_lifecycle(thread)
    end
  end

  test "Doc relations are included in DocSnapshot data" do
    {community, _existing_doc, attrs, user} = mock_article(:doc)
    {:ok, group} = CMS.Communities.create_tag_group(community, :doc, %{title: "Doc relations"})

    {:ok, tag} =
      CMS.Communities.create_tag(
        community,
        :doc,
        Map.merge(mock_attrs(:community_tag), %{group_id: group.id}),
        user
      )

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :doc,
        Map.merge(attrs, %{community_tags: [tag.id], title: "Doc relation draft"}),
        user
      )

    {:ok, snapshot} = CMS.Docs.checkpoint_snapshot(community, draft.article_hash_id, user)

    assert relation_value(snapshot.data, :community_tag_ids) == [tag.id]
  end

  defp assert_tag_lifecycle(thread) do
    {community, _existing_article, attrs, user} = mock_article(thread)
    {:ok, group} = CMS.Communities.create_tag_group(community, thread, %{title: "Versioned"})

    {:ok, tag} =
      CMS.Communities.create_tag(
        community,
        thread,
        Map.merge(mock_attrs(:community_tag), %{group_id: group.id}),
        user
      )

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        thread,
        Map.merge(attrs, %{community_tags: [tag.id], title: "#{thread} relation draft"}),
        user
      )

    {:ok, %{article: public_article, snapshot: nil}} =
      CMS.Articles.publish_draft(community, thread, draft.article_hash_id, user)

    assert public_article
           |> Repo.preload(:community_tags)
           |> Map.fetch!(:community_tags)
           |> hd()
           |> Map.fetch!(:id) == tag.id
  end

  defp relation_value(data, key), do: Map.get(data, key, Map.get(data, Atom.to_string(key)))
end
