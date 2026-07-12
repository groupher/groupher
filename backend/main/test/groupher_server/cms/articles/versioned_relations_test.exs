defmodule GroupherServer.Test.CMS.Articles.VersionedRelations do
  @moduledoc false

  use GroupherServer.TestMate

  test "Post keeps versioned Tags through Snapshot, Publish, and Preview" do
    assert_tag_lifecycle(:post)
  end

  test "Blog keeps versioned Tags through Snapshot, Publish, and Preview" do
    assert_tag_lifecycle(:blog)
  end

  test "Changelog keeps versioned Tags through Snapshot, Publish, and Preview" do
    assert_tag_lifecycle(:changelog)
  end

  test "Doc keeps versioned Tags through Snapshot, Publish, and Preview" do
    assert_tag_lifecycle(:doc)
  end

  test "Preview clones mutable Cover editor state instead of sharing main/public state" do
    {community, _existing_article, attrs, user} = mock_article(:post)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :post,
        Map.put(attrs, :title, "Cover relation draft"),
        user
      )

    {:ok, background} = ORM.create(CMS.Model.CoverBackground, %{})

    {:ok, cover} =
      ORM.create(CMS.Model.CoverEditInfo, %{
        canvas_width: 1200,
        canvas_height: 630,
        light: %{background_id: background.id, images: []},
        dark: %{background_id: background.id, images: []}
      })

    {:ok, draft} =
      ORM.update(
        draft,
        %{
          cover_url: "https://img.test/light.png",
          cover_url_dark: "https://img.test/dark.png",
          cover_edit_info_id: cover.id
        },
        strict: false
      )

    {:ok, checkpoint} =
      CMS.Articles.checkpoint_draft(community, :post, draft.article_hash_id, user)

    assert relation_value(checkpoint.data, :cover) |> relation_value(:canvas_width) == 1200

    {:ok, _published} =
      CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

    {:ok, public_article} =
      CMS.Articles.read_public(community, :post, draft.article_hash_id)

    {:ok, forked} =
      CMS.Articles.fork_preview(
        community,
        :post,
        draft.article_hash_id,
        %{slug: "cover-preview", title: "Cover Preview"},
        user
      )

    refute forked.draft.cover_edit_info_id == public_article.cover_edit_info_id

    {:ok, preview_cover} = ORM.find(CMS.Model.CoverEditInfo, forked.draft.cover_edit_info_id)
    {:ok, _preview_cover} = ORM.update(preview_cover, %{canvas_width: 1600})
    {:ok, public_cover} = ORM.find(CMS.Model.CoverEditInfo, public_article.cover_edit_info_id)

    assert public_cover.canvas_width == 1200
  end

  defp assert_tag_lifecycle(thread) do
    {community, _existing_article, attrs, user} = mock_article(thread)
    {:ok, group} = CMS.Communities.create_tag_group(community, thread, %{title: "Versioned"})

    tag_attrs = Map.merge(mock_attrs(:community_tag), %{group_id: group.id})
    {:ok, tag} = CMS.Communities.create_tag(community, thread, tag_attrs, user)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        thread,
        attrs
        |> Map.put(:title, "#{thread} relation draft")
        |> Map.put(:community_tags, [tag.id]),
        user
      )

    {:ok, checkpoint} =
      CMS.Articles.checkpoint_draft(community, thread, draft.article_hash_id, user)

    assert relation_value(checkpoint.data, :community_tag_ids) == [tag.id]

    {:ok, _published} =
      CMS.Articles.publish_draft(community, thread, draft.article_hash_id, user)

    {:ok, public_article} =
      CMS.Articles.read_public(community, thread, draft.article_hash_id)

    assert public_article
           |> Repo.preload(:community_tags)
           |> Map.fetch!(:community_tags)
           |> hd()
           |> Map.fetch!(:id) ==
             tag.id

    {:ok, forked} =
      CMS.Articles.fork_preview(
        community,
        thread,
        draft.article_hash_id,
        %{slug: "#{thread}-relations-preview", title: "Relations Preview"},
        user
      )

    assert forked.draft
           |> Repo.preload(:community_tags)
           |> Map.fetch!(:community_tags)
           |> Enum.map(& &1.id) == [tag.id]
  end

  defp relation_value(data, key), do: Map.get(data, key, Map.get(data, Atom.to_string(key)))
end
