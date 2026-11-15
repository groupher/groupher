defmodule GroupherServer.Test.CMS.Articles.WorkingCopySnapshotTest do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleAssetRef, ArticleWorkingCopyTag}

  test "saving only a cover asset selection synchronizes WorkingCopy refs" do
    {community, public, _attrs, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    article = Repo.get!(CMS.Model.Article, public.article_id)

    work =
      Repo.get_by!(CMS.Model.ArticleWorkingCopy, article_id: article.id, scope_type: :default)

    selected = Repo.get!(CMS.Model.ArticlePublic, article.id)

    assert {:ok, asset} =
             CMS.Assets.register_to_community(
               community,
               %{url: "https://assets.example.test/cover-only.png", size_bytes: 24},
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{cover_asset_id: asset.id},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert Repo.get_by!(ArticleAssetRef, working_copy_id: work.id, usage: :cover).asset_id ==
             asset.id

    refute Repo.get_by(ArticleAssetRef, snapshot_id: selected.snapshot_id, usage: :cover)

    assert {:ok, _} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{cover_asset_id: nil},
               saved.revision,
               actor,
               Ecto.UUID.generate()
             )

    refute Repo.get_by(ArticleAssetRef, working_copy_id: work.id, usage: :cover)
    assert Repo.get!(CMS.Model.ArticlePublic, article.id).snapshot_id == selected.snapshot_id
  end

  test "new Article create command rejects Doc until Docs joins the snapshot publish path" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)

    assert {:error, :unsupported_article_thread} =
             CMS.Articles.create_article(community, :doc, %{}, actor,
               command_id: Ecto.UUID.generate()
             )
  end

  test "Public meta keeps Article edit, sink, and last-active state" do
    {community, article, _attrs, _actor} =
      GroupherServer.Test.ArticleContentFixture.article(:post)

    inner_id = article.inner_id
    last_active_at = DateTime.add(DateTime.utc_now(:second), -3, :day)

    Repo.get!(CMS.Model.Article, article.id)
    |> CMS.Model.Article.changeset(%{
      is_edited: true,
      is_sunk: true,
      last_active_at: last_active_at
    })
    |> Repo.update!()

    assert {:ok, public_article} =
             CMS.FrontDesk.article(%{
               community: community.slug,
               thread: :post,
               inner_id: Integer.to_string(inner_id)
             })

    assert public_article.meta.is_edited
    assert public_article.meta.is_sunk
    assert public_article.meta.last_active_at == last_active_at
  end

  test "saved WorkingCopy freezes, publishes, clones, and compares by immutable content" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)
    tag_attrs = mock_attrs(:community_tag)

    assert {:ok, article_tag} =
             CMS.Communities.create_tag(
               community,
               :post,
               tag_attrs,
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, asset} =
             CMS.Assets.register_to_community(
               community,
               %{url: "https://assets.example.test/article-base/attachment.png", size_bytes: 32},
               actor,
               Ecto.UUID.generate()
             )

    create_command_id = Ecto.UUID.generate()

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{
                 title: "Working title",
                 body_bag: body_bag("first body"),
                 tag_ids: [article_tag.id],
                 copy_right: "© Article base",
                 link_addr: "https://example.test/article",
                 cover_url: "https://example.test/cover.png",
                 cover_url_dark: "https://example.test/cover-dark.png",
                 asset_refs: [%{asset_id: asset.id, usage: :attachment, title: "Reference only"}],
                 cover_edit: %{
                   canvas_width: 1200,
                   canvas_height: 630,
                   light: %{
                     "background" => "white"
                   },
                   dark: %{"background" => "black"}
                 }
               },
               actor,
               command_id: create_command_id
             )

    assert work.revision == 1
    assert {:ok, work_fields} = CMS.Articles.working_copy_thread_fields(work)

    assert work_fields == %{
             copy_right: "© Article base",
             link_addr: "https://example.test/article",
             cover_url: "https://example.test/cover.png",
             cover_url_dark: "https://example.test/cover-dark.png"
           }

    assert {:ok, working_copy_usage} = CMS.Assets.usage_summary(community, asset.id, actor)
    assert working_copy_usage.draft == 1
    assert working_copy_usage.live == 0

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Saved title", body_bag: body_bag("saved body")},
               1,
               actor,
               Ecto.UUID.generate()
             )

    assert saved.revision == 2
    assert saved.digest == "first body"

    assert {:ok, no_op_saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Saved title"},
               saved.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert no_op_saved.revision == 3

    invalid_body = Map.put(body_bag("must not persist"), :json, "not plate json")

    assert {:error, _invalid_body_error} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{body_bag: invalid_body},
               no_op_saved.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert Repo.get!(CMS.Model.ArticleWorkingCopy, work.id).revision == no_op_saved.revision
    assert Repo.get!(CMS.Model.ArticleWorkingCopy, work.id).title == no_op_saved.title

    assert {:error, conflict} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "stale write"},
               1,
               actor,
               Ecto.UUID.generate()
             )

    assert CMS.ErrorCat.code(conflict) == 4561

    autosaved =
      Enum.reduce(1..100, no_op_saved, fn index, current ->
        assert {:ok, next} =
                 CMS.Articles.save_working_copy(
                   article,
                   community,
                   work.id,
                   %{body_bag: body_bag("autosave #{index}")},
                   current.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

        next
      end)

    assert autosaved.revision == 103

    assert Repo.aggregate(
             from(row in CMS.Model.ArticleWorkingCopy, where: row.article_id == ^article.id),
             :count
           ) == 1

    assert {:ok, %{public: public}} =
             CMS.Articles.publish_article(
               article,
               community,
               %{working_copy_id: work.id, revision: autosaved.revision},
               nil,
               actor,
               Ecto.UUID.generate()
             )

    snapshot = Repo.get!(CMS.Model.ArticleSnapshot, public.snapshot_id)

    frozen_body =
      CMS.Articles.Body.document(snapshot)

    assert public.snapshot_id == snapshot.id
    assert CMS.Articles.Body.document(snapshot).json == CMS.Articles.Body.document(autosaved).json
    assert {:ok, snapshot_fields} = CMS.Articles.snapshot_thread_fields(snapshot)
    assert snapshot_fields == work_fields

    snapshot_ref =
      Repo.get_by!(ArticleAssetRef,
        snapshot_id: snapshot.id,
        asset_id: asset.id,
        usage: :attachment
      )

    assert snapshot_ref.usage == :attachment

    assert {:ok, published_usage} = CMS.Assets.usage_summary(community, asset.id, actor)
    assert published_usage.draft == 1
    assert published_usage.live == 1

    assert {:ok, %{inner_id: inner_id}} =
             CMS.Articles.Bindings.fetch_binding(article.id, community.id)

    assert {:ok, public_article} =
             CMS.FrontDesk.article(%{
               community: community.slug,
               thread: :post,
               inner_id: inner_id
             })

    assert public_article.snapshot_id == snapshot.id
    assert public_article.body.json == CMS.Articles.Body.document(snapshot).json
    assert public_article.body.markdown == CMS.Articles.Body.document(snapshot).markdown
    assert public_article.body.html == CMS.Articles.Body.document(snapshot).html
    assert public_article.body.markdown_toc == CMS.Articles.Body.document(snapshot).markdown_toc
    assert public_article.body.plain_text == CMS.Articles.Body.document(snapshot).plain_text
    assert public_article.body.thumbnail == CMS.Articles.Body.document(snapshot).thumbnail

    assert {:ok, indexed_article} =
             CMS.SearchArtiments.Projection.Article.project(:post, public_article)

    assert indexed_article.indexed_snapshot_id == snapshot.id
    assert is_nil(indexed_article.content_hash)

    assert {:ok, %{public: republished}} =
             CMS.Articles.publish_article(
               article,
               community,
               %{working_copy_id: work.id, revision: autosaved.revision},
               snapshot.id,
               actor,
               Ecto.UUID.generate()
             )

    assert republished.snapshot_id == snapshot.id

    assert {:ok, _source_edit} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{body_bag: body_bag("edited after publish")},
               autosaved.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert CMS.Articles.Body.document(Repo.get!(CMS.Model.ArticleSnapshot, snapshot.id)) ==
             frozen_body

    snapshots_before_select =
      Repo.aggregate(
        from(row in CMS.Model.ArticleSnapshot, where: row.article_id == ^article.id),
        :count
      )

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :last_publish_time,
      actor,
      minutes: -CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes
    )

    assert {:ok, %{public: selected_snapshot}} =
             CMS.Articles.publish_article(
               article,
               community,
               %{snapshot_id: snapshot.id},
               snapshot.id,
               actor,
               Ecto.UUID.generate()
             )

    assert selected_snapshot.snapshot_id == snapshot.id

    assert Repo.aggregate(
             from(row in CMS.Model.ArticleSnapshot, where: row.article_id == ^article.id),
             :count
           ) == snapshots_before_select

    fork_command_id = Ecto.UUID.generate()
    clone_scope_id = Ecto.UUID.generate()

    assert {:ok, %{working_copy: clone}} =
             CMS.Articles.fork_snapshot(
               snapshot.id,
               community,
               :workspace,
               clone_scope_id,
               actor,
               fork_command_id
             )

    assert {:ok, %{working_copy: retried_clone}} =
             CMS.Articles.fork_snapshot(
               snapshot.id,
               community,
               :workspace,
               clone_scope_id,
               actor,
               fork_command_id
             )

    assert retried_clone.id == clone.id

    assert {:ok, %{working_copy: clone_two}} =
             CMS.Articles.fork_snapshot(
               snapshot.id,
               community,
               :workspace,
               Ecto.UUID.generate(),
               actor,
               Ecto.UUID.generate()
             )

    assert clone.id != work.id
    assert clone.revision == 1
    assert CMS.Articles.Body.document(clone).json == CMS.Articles.Body.document(snapshot).json
    assert clone.cover_edit_working_copy_id != snapshot.cover_edit_snapshot_id
    assert clone_two.cover_edit_working_copy_id != clone.cover_edit_working_copy_id
    assert working_copy_tag_ids(clone.id) == [article_tag.id]
    assert working_copy_tag_ids(clone_two.id) == [article_tag.id]

    clone_ref =
      Repo.get_by!(ArticleAssetRef,
        working_copy_id: clone.id,
        asset_id: asset.id,
        usage: :attachment
      )

    clone_two_ref =
      Repo.get_by!(ArticleAssetRef,
        working_copy_id: clone_two.id,
        asset_id: asset.id,
        usage: :attachment
      )

    assert clone_ref.id != clone_two_ref.id
    assert clone_ref.id != snapshot_ref.id

    assert {:ok, changed_clone} =
             CMS.Articles.save_working_copy(
               article,
               community,
               clone.id,
               %{
                 title: "Clone title",
                 tag_ids: [],
                 cover_edit: %{
                   canvas_width: 1200,
                   canvas_height: 630,
                   light: %{"background" => "green"},
                   dark: %{"background" => "black"}
                 }
               },
               clone.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert changed_clone.title == "Clone title"
    assert working_copy_tag_ids(clone.id) == []
    assert working_copy_tag_ids(clone_two.id) == [article_tag.id]

    assert Repo.get_by(ArticleAssetRef,
             working_copy_id: clone.id,
             asset_id: asset.id,
             usage: :attachment
           )

    assert Repo.get(ArticleAssetRef, clone_two_ref.id)

    assert Repo.get!(CMS.Model.CoverEditWorkingCopy, clone_two.cover_edit_working_copy_id).light ==
             %{"background" => "white"}

    assert Repo.get!(CMS.Model.CoverEditSnapshot, snapshot.cover_edit_snapshot_id).light ==
             %{"background" => "white"}

    assert {:ok, cover_cleared} =
             CMS.Articles.save_working_copy(
               article,
               community,
               clone.id,
               %{cover_edit: nil},
               changed_clone.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert is_nil(cover_cleared.cover_edit_working_copy_id)

    assert Repo.get_by(ArticleAssetRef,
             working_copy_id: clone.id,
             asset_id: asset.id,
             usage: :attachment
           )

    assert Repo.get(ArticleAssetRef, clone_two_ref.id)

    assert {:ok, assets_cleared} =
             CMS.Articles.save_working_copy(
               article,
               community,
               clone.id,
               %{asset_refs: []},
               cover_cleared.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert assets_cleared.revision == cover_cleared.revision + 1
    refute Repo.get_by(ArticleAssetRef, working_copy_id: clone.id, asset_id: asset.id)
    assert Repo.get(ArticleAssetRef, clone_two_ref.id)

    assert Repo.get!(CMS.Model.CoverEditWorkingCopy, clone_two.cover_edit_working_copy_id).light ==
             %{"background" => "white"}

    assert Repo.get!(CMS.Model.CoverEditSnapshot, snapshot.cover_edit_snapshot_id).light ==
             %{"background" => "white"}

    assert Repo.get!(CMS.Model.ArticleSnapshot, snapshot.id).title == "Saved title"
    assert {:ok, %{fields: fields}} = CMS.Articles.WorkingCopy.Diff.compare(snapshot.id, clone.id)
    assert fields.title == %{before: "Saved title", after: "Clone title"}
  end

  test "CreateAndPublish commits one complete Snapshot or rolls the Article back" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)
    initial_count = Repo.aggregate(CMS.Model.Article, :count)
    initial_work_count = Repo.aggregate(CMS.Model.ArticleWorkingCopy, :count)
    initial_snapshot_count = Repo.aggregate(CMS.Model.ArticleSnapshot, :count)
    initial_public_count = Repo.aggregate(CMS.Model.ArticlePublic, :count)

    assert {:error, :invalid_body} =
             CMS.Articles.create_and_publish_article(
               community,
               :post,
               %{title: "No visible content", body_bag: empty_body_bag()},
               actor,
               command_id: Ecto.UUID.generate()
             )

    assert Repo.aggregate(CMS.Model.Article, :count) == initial_count
    assert Repo.aggregate(CMS.Model.ArticleWorkingCopy, :count) == initial_work_count
    assert Repo.aggregate(CMS.Model.ArticleSnapshot, :count) == initial_snapshot_count
    assert Repo.aggregate(CMS.Model.ArticlePublic, :count) == initial_public_count

    assert {:ok, %{article: article, working_copy: work, public: public}} =
             CMS.Articles.create_and_publish_article(
               community,
               :post,
               %{title: "Atomic publish", digest: "", body_bag: body_bag("complete body")},
               actor,
               command_id: Ecto.UUID.generate()
             )

    assert public.article_id == article.id
    assert public.digest == ""
    assert work.article_id == article.id
    snapshot = Repo.get!(CMS.Model.ArticleSnapshot, public.snapshot_id)
    assert CMS.Articles.Body.document(snapshot).plain_text == "complete body"

    assert CMS.Articles.Body.document(snapshot).thumbnail == %{
             "version" => 1,
             "blocks" => [%{"type" => "paragraph", "text" => "complete body"}]
           }
  end

  test "deleteWorkingCopy protects the last unpublished work and rolls back on any external FK" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)

    assert {:ok, %{article: unpublished, working_copy: only_work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "Unpublished", body_bag: body_bag("unpublished")},
               actor,
               command_id: Ecto.UUID.generate()
             )

    assert {:error, last_work_error} =
             CMS.Articles.delete_working_copy(
               unpublished,
               community,
               only_work.id,
               actor,
               Ecto.UUID.generate()
             )

    assert CMS.ErrorCat.code(last_work_error) == 4562
    assert Repo.get(CMS.Model.ArticleWorkingCopy, only_work.id)

    assert {:ok, %{article: article, working_copy: original, public: public}} =
             CMS.Articles.create_and_publish_article(
               community,
               :post,
               %{title: "Published", body_bag: body_bag("published")},
               actor,
               command_id: Ecto.UUID.generate()
             )

    assert {:ok, %{working_copy: work}} =
             CMS.Articles.fork_snapshot(
               public.snapshot_id,
               community,
               :workspace,
               Ecto.UUID.generate(),
               actor,
               Ecto.UUID.generate()
             )

    assert work.id != original.id

    {:ok, asset} =
      CMS.Assets.register_to_community(
        community,
        %{url: "https://assets.example.test/delete-ref.png", size_bytes: 12},
        actor,
        Ecto.UUID.generate()
      )

    tag_attrs = mock_attrs(:community_tag)

    assert {:ok, tag} =
             CMS.Communities.create_tag(
               community,
               :post,
               tag_attrs,
               actor,
               Ecto.UUID.generate()
             )

    %ArticleWorkingCopyTag{}
    |> ArticleWorkingCopyTag.changeset(%{working_copy_id: work.id, tag_id: tag.id})
    |> Repo.insert!()

    %ArticleAssetRef{}
    |> ArticleAssetRef.changeset(%{
      community_id: community.id,
      asset_id: asset.id,
      working_copy_id: work.id,
      usage: :inline,
      block_id: "delete-ref"
    })
    |> Repo.insert!()

    cover =
      %CMS.Model.CoverEditWorkingCopy{
        format_version: 1,
        canvas_width: 1200,
        canvas_height: 630,
        light: %{"background" => "white"},
        dark: %{"background" => "black"}
      }
      |> CMS.Model.CoverEditWorkingCopy.changeset(%{})
      |> Repo.insert!()

    work
    |> Ecto.Changeset.change(cover_edit_working_copy_id: cover.id)
    |> Repo.update!()

    Repo.query!(
      "CREATE TABLE cms.article_working_copy_delete_ref_test (working_copy_id uuid NOT NULL REFERENCES cms.article_working_copies(id) ON DELETE RESTRICT)"
    )

    Repo.query!(
      "INSERT INTO cms.article_working_copy_delete_ref_test (working_copy_id) VALUES ($1)",
      [Ecto.UUID.dump!(work.id)]
    )

    assert {:error, in_use_error} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               work.id,
               actor,
               Ecto.UUID.generate()
             )

    assert CMS.ErrorCat.code(in_use_error) == 4563
    assert Repo.get(CMS.Model.ArticleWorkingCopy, work.id)
    assert Repo.get(CMS.Model.CoverEditWorkingCopy, cover.id)
    assert Repo.get_by(ArticleWorkingCopyTag, working_copy_id: work.id, tag_id: tag.id)
    assert Repo.get_by(ArticleAssetRef, working_copy_id: work.id, asset_id: asset.id)

    assert Repo.query!(
             "SELECT working_copy_id FROM cms.article_working_copy_delete_ref_test WHERE working_copy_id = $1",
             [Ecto.UUID.dump!(work.id)]
           ).num_rows == 1

    Repo.query!(
      "DELETE FROM cms.article_working_copy_delete_ref_test WHERE working_copy_id = $1",
      [Ecto.UUID.dump!(work.id)]
    )

    Repo.query!("DROP TABLE cms.article_working_copy_delete_ref_test")

    Repo.query!(
      "CREATE TABLE cms.cover_edit_delete_ref_test (cover_id uuid NOT NULL REFERENCES cms.cover_edit_working_copies(id) ON DELETE RESTRICT)"
    )

    Repo.query!(
      "INSERT INTO cms.cover_edit_delete_ref_test (cover_id) VALUES ($1)",
      [Ecto.UUID.dump!(cover.id)]
    )

    assert {:error, cover_delete_error} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               work.id,
               actor,
               Ecto.UUID.generate()
             )

    assert CMS.ErrorCat.code(cover_delete_error) == 4564
    assert Repo.get(CMS.Model.ArticleWorkingCopy, work.id)
    assert Repo.get(CMS.Model.CoverEditWorkingCopy, cover.id)
    assert Repo.get_by(ArticleWorkingCopyTag, working_copy_id: work.id, tag_id: tag.id)
    assert Repo.get_by(ArticleAssetRef, working_copy_id: work.id, asset_id: asset.id)

    Repo.query!(
      "DELETE FROM cms.cover_edit_delete_ref_test WHERE cover_id = $1",
      [Ecto.UUID.dump!(cover.id)]
    )

    Repo.query!("DROP TABLE cms.cover_edit_delete_ref_test")

    assert {:ok, _deleted_article} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               work.id,
               actor,
               Ecto.UUID.generate()
             )

    refute Repo.get(CMS.Model.ArticleWorkingCopy, work.id)
    refute Repo.get(CMS.Model.CoverEditWorkingCopy, cover.id)
    refute Repo.get_by(ArticleWorkingCopyTag, working_copy_id: work.id, tag_id: tag.id)
    refute Repo.get_by(ArticleAssetRef, working_copy_id: work.id, asset_id: asset.id)
  end

  test "empty WorkingCopy saves, denied actors write nothing, and empty content cannot publish" do
    {:ok, actor} = db_insert(:user)
    {:ok, unauthorized_actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "", digest: "", body_bag: empty_body_bag()},
               actor,
               command_id: Ecto.UUID.generate()
             )

    assert {:error, _forbidden} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "unauthorized overwrite"},
               work.revision,
               unauthorized_actor,
               Ecto.UUID.generate()
             )

    assert Repo.get!(CMS.Model.ArticleWorkingCopy, work.id).title == ""
    assert Repo.get!(CMS.Model.ArticleWorkingCopy, work.id).revision == 1

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{body_bag: empty_body_bag()},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert saved.revision == 2
    assert CMS.Articles.Body.document(saved).json == empty_body_bag().json

    assert {:error, :invalid_body} =
             CMS.Articles.publish_article(
               article,
               community,
               %{working_copy_id: work.id, revision: saved.revision},
               nil,
               actor,
               Ecto.UUID.generate()
             )

    refute Repo.get(CMS.Model.ArticlePublic, article.id)

    assert Repo.aggregate(
             from(snapshot in CMS.Model.ArticleSnapshot,
               where: snapshot.article_id == ^article.id
             ),
             :count
           ) == 0
  end

  defp body_bag(text) do
    json =
      Jason.encode!([
        %{"id" => Ecto.UUID.generate(), "type" => "p", "children" => [%{"text" => text}]}
      ])

    %{
      json: json,
      markdown: text,
      html: "<p>#{text}</p>",
      toc: [],
      plain_text: text,
      digest: text,
      body_hash: :crypto.hash(:sha256, json) |> Base.encode16(case: :lower),
      schema_version: 2,
      thumbnail: %{version: 1, blocks: [%{type: "paragraph", text: text}]}
    }
  end

  defp working_copy_tag_ids(working_copy_id) do
    Repo.all(
      from(tag in CMS.Model.ArticleWorkingCopyTag,
        where: tag.working_copy_id == ^working_copy_id,
        select: tag.tag_id,
        order_by: tag.tag_id
      )
    )
  end

  defp empty_body_bag do
    %{
      json: ~S([{"children":[{"text":""}],"type":"p"}]),
      markdown: "",
      html: "<p></p>",
      toc: [],
      plain_text: "",
      digest: "",
      body_hash: :crypto.hash(:sha256, "empty") |> Base.encode16(case: :lower),
      schema_version: 2,
      thumbnail: %{version: 1, blocks: []}
    }
  end
end
