defmodule GroupherServer.Test.CMS.DocTree.Publish.ContentStateTest do
  use GroupherServer.TestMate
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.WorkingCopy.{Snapshotter, Store}
  alias CMS.DocTree.Publish.{ContentMerge, ContentState}
  alias CMS.Model.{Article, ArticleAssetRef, ArticleBinding, ArticleWorkingCopy, Author}

  defp body_bag(text) do
    json = Jason.encode!([%{"id" => "a", "type" => "p", "children" => [%{"text" => text}]}])

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

  test "body attachments are rebuilt from the body and never become independent attachments" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)
    author = Repo.get_by!(Author, user_id: actor.id)

    assert {:ok, asset} =
             CMS.Assets.register_to_community(
               community,
               %{url: "https://assets.example.test/docs/body-file", size_bytes: 32},
               actor,
               Ecto.UUID.generate()
             )

    asset =
      asset
      |> Ecto.Changeset.change(public_ref: "asset_" <> Ecto.UUID.generate())
      |> Repo.update!()

    json =
      Jason.encode!([
        %{
          "id" => "file-1",
          "type" => "file",
          "assetPublicRef" => asset.public_ref,
          "children" => [%{"text" => ""}]
        }
      ])

    bag =
      body_bag("file")
      |> Map.put(:json, json)
      |> Map.put(:body_hash, :crypto.hash(:sha256, json) |> Base.encode16(case: :lower))

    assert {:ok, work} =
             Repo.transaction(fn ->
               article =
                 %Article{}
                 |> Article.changeset(%{thread: :doc, author_id: author.id})
                 |> Repo.insert!()

               %ArticleBinding{}
               |> ArticleBinding.changeset(%{
                 article_id: article.id,
                 community_id: community.id,
                 thread: :doc
               })
               |> Repo.insert!()

               {:ok, work} =
                 Store.create_loaded(
                   article,
                   %{
                     scope_type: :default,
                     scope_id: article.id,
                     title: "Attachment ownership",
                     body_bag: bag,
                     asset_refs: [%{asset_id: asset.id, usage: :attachment, title: "Independent"}]
                   },
                   actor,
                   community.id
                 )

               assert {:ok, state} = ContentState.load(work)
               assert [%{title: "Independent"}] = state.asset_refs

               assert Repo.aggregate(
                        from(r in ArticleAssetRef, where: r.working_copy_id == ^work.id),
                        :count
                      ) == 2

               {:ok, work} =
                 Store.save_loaded(
                   work,
                   %{subtitle: "Changed"},
                   actor,
                   work.revision,
                   community.id
                 )

               refs = Repo.all(from(r in ArticleAssetRef, where: r.working_copy_id == ^work.id))
               assert Enum.frequencies_by(refs, & &1.source) == %{"plate" => 1, nil => 1}
               assert {:ok, before_body_change} = ContentState.load(work)

               {:ok, work} =
                 Store.save_loaded(
                   work,
                   %{body_bag: body_bag("no file")},
                   actor,
                   work.revision,
                   community.id
                 )

               refs = Repo.all(from(r in ArticleAssetRef, where: r.working_copy_id == ^work.id))
               assert [%ArticleAssetRef{title: "Independent", source: nil}] = refs
               assert {:ok, state} = ContentState.load(work)
               assert [%{title: "Independent"}] = state.asset_refs

               assert {:ok, [:body]} =
                        ContentMerge.exclusive_changes(
                          before_body_change,
                          state,
                          before_body_change
                        )

               work
             end)

    assert {:error, _} =
             Repo.transact(fn ->
               Store.save_loaded(
                 work,
                 %{asset_refs: [%{asset_id: asset.id, usage: :attachment, source: "plate"}]},
                 actor,
                 work.revision,
                 community.id
               )
             end)

    assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
  end

  test "merged save preserves selected cover reference metadata and rolls back invalid selections" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)
    author = Repo.get_by!(Author, user_id: actor.id)

    assert {:ok, asset} =
             CMS.Assets.register_to_community(
               community,
               %{url: "https://assets.example.test/docs/merge-cover.png", size_bytes: 32},
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, {snapshot, copy}} =
             Repo.transact(fn ->
               article =
                 %Article{}
                 |> Article.changeset(%{thread: :doc, author_id: author.id})
                 |> Repo.insert!()

               %ArticleBinding{}
               |> ArticleBinding.changeset(%{
                 article_id: article.id,
                 community_id: community.id,
                 thread: :doc
               })
               |> Repo.insert!()

               {:ok, default} =
                 Store.create_loaded(
                   article,
                   %{
                     scope_type: :default,
                     scope_id: article.id,
                     title: "Doc",
                     body_bag: body_bag("body")
                   },
                   actor,
                   community.id
                 )

               %ArticleAssetRef{}
               |> ArticleAssetRef.changeset(%{
                 community_id: community.id,
                 working_copy_id: default.id,
                 asset_id: asset.id,
                 usage: :cover,
                 position: 4,
                 title: "Cover title",
                 alt: "Cover alternative",
                 source: "article_cover",
                 meta: %{"origin" => "selected"}
               })
               |> Repo.insert!()

               {:ok, snapshot} =
                 Snapshotter.freeze_in_transaction(
                   default.id,
                   default.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

               {:ok, copy} =
                 Snapshotter.fork_snapshot_in_transaction(
                   snapshot.id,
                   %{
                     article_id: article.id,
                     scope_type: :workspace,
                     scope_id: Ecto.UUID.generate()
                   },
                   actor
                 )

               {:ok, {snapshot, copy}}
             end)

    assert {:ok, selected} = ContentState.load(snapshot)

    assert [%{title: "Cover title", alt: "Cover alternative", source: "article_cover"}] =
             selected.cover_refs

    assert {:ok, saved} =
             Repo.transact(fn ->
               Store.save_merged_loaded(
                 copy,
                 snapshot,
                 %{title: "Merged"},
                 selected.cover_refs,
                 actor,
                 copy.revision,
                 community.id
               )
             end)

    assert {:ok, content} = ContentState.load(saved)
    assert content.cover_refs == selected.cover_refs
    assert saved.revision == copy.revision + 1

    assert {:error, _} =
             Repo.transact(fn ->
               Store.save_merged_loaded(
                 saved,
                 snapshot,
                 %{title: "Must roll back"},
                 selected.cover_refs ++ selected.cover_refs,
                 actor,
                 saved.revision,
                 community.id
               )
             end)

    assert Repo.get!(ArticleWorkingCopy, saved.id).revision == saved.revision
    assert {:ok, after_failure} = ContentState.load(saved)
    assert after_failure.cover_refs == selected.cover_refs

    {:ok, other_community} = GroupherServer.Test.ArticleContentFixture.community(actor)

    assert {:ok, other_asset} =
             CMS.Assets.register_to_community(
               other_community,
               %{url: "https://assets.example.test/docs/other-cover.png", size_bytes: 32},
               actor,
               Ecto.UUID.generate()
             )

    foreign_refs = Enum.map(selected.cover_refs, &Map.put(&1, :asset_id, other_asset.id))

    assert {:error, _} =
             Repo.transact(fn ->
               Store.save_merged_loaded(
                 saved,
                 snapshot,
                 %{title: "Must roll back"},
                 foreign_refs,
                 actor,
                 saved.revision,
                 community.id
               )
             end)

    assert Repo.get!(ArticleWorkingCopy, saved.id).revision == saved.revision
    assert {:ok, after_foreign} = ContentState.load(saved)
    assert after_foreign.cover_refs == selected.cover_refs
  end

  test "loads equivalent real Doc WorkingCopy and frozen Snapshot including dependent content" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)
    author = Repo.get_by!(Author, user_id: actor.id)

    assert {:ok, asset} =
             CMS.Assets.register_to_community(
               community,
               %{url: "https://assets.example.test/docs/attachment.png", size_bytes: 32},
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, tag} =
             CMS.Communities.create_tag(
               community,
               :doc,
               mock_attrs(:community_tag),
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, {work, snapshot}} =
             Repo.transaction(fn ->
               article =
                 %Article{}
                 |> Article.changeset(%{thread: :doc, author_id: author.id})
                 |> Repo.insert!()

               %ArticleBinding{}
               |> ArticleBinding.changeset(%{
                 article_id: article.id,
                 community_id: community.id,
                 thread: :doc
               })
               |> Repo.insert!()

               {:ok, work} =
                 Store.create_loaded(
                   article,
                   %{
                     scope_type: :default,
                     scope_id: article.id,
                     title: "Doc content",
                     subtitle: "Subtitle",
                     body_bag: body_bag("persisted body"),
                     tag_ids: [tag.id],
                     cover_edit: %{
                       canvas_width: 1200,
                       canvas_height: 630,
                       light: %{"background" => "white"},
                       dark: %{"background" => "black"}
                     },
                     asset_refs: [
                       %{
                         asset_id: asset.id,
                         usage: :attachment,
                         title: "Attachment",
                         block_id: "attachment-block",
                         block_type: "file"
                       }
                     ]
                   },
                   actor,
                   community.id
                 )

               {:ok, work} =
                 Store.save_loaded(
                   work,
                   %{subtitle: "Updated"},
                   actor,
                   work.revision,
                   community.id
                 )

               work =
                 work
                 |> Repo.preload(:body)
                 |> ArticleWorkingCopy.changeset(%{
                   body: %{xml: "<xml>saved</xml>", rss: "rss saved"}
                 })
                 |> Repo.update!()

               {:ok, snapshot} =
                 Snapshotter.freeze_in_transaction(
                   work.id,
                   work.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

               {work, snapshot}
             end)

    assert {:ok, work_content} = ContentState.load(work)
    assert {:ok, snapshot_content} = ContentState.load(snapshot)
    assert work_content.subtitle == "Updated"
    assert work_content.tags == [tag.id]

    assert [
             %{
               asset_id: asset_id,
               usage: :attachment,
               title: "Attachment",
               block_id: "attachment-block",
               block_type: "file"
             }
           ] =
             work_content.asset_refs

    assert asset_id == asset.id
    assert work_content.cover_edit.canvas_width == 1200

    assert {:ok, []} =
             ContentMerge.exclusive_changes(snapshot_content, work_content, snapshot_content)

    assert {:ok, edited} =
             Repo.transaction(fn ->
               {:ok, edited} =
                 Store.save_loaded(
                   work,
                   %{body_bag: body_bag("new body")},
                   actor,
                   work.revision,
                   community.id
                 )

               edited
             end)

    assert CMS.Articles.Body.document(edited).xml == "<xml>saved</xml>"

    assert {:ok, restored} =
             Repo.transaction(fn ->
               {:ok, restored} =
                 Store.save_stored_body_loaded(
                   edited,
                   snapshot,
                   %{title: "Restored"},
                   actor,
                   edited.revision,
                   community.id
                 )

               restored
             end)

    assert restored.revision == edited.revision + 1
    assert CMS.Articles.Body.document(restored).xml == "<xml>saved</xml>"
    assert CMS.Articles.Body.document(restored).rss == "rss saved"
    assert CMS.Articles.Body.document(restored).json == CMS.Articles.Body.document(snapshot).json
    assert {:ok, restored_content} = ContentState.load(restored)
    assert restored_content.tags == [tag.id]
    assert restored_content.cover_edit == work_content.cover_edit
    assert restored_content.asset_refs == work_content.asset_refs

    assert {:error, _reason} =
             Repo.transaction(fn ->
               case Store.save_stored_body_loaded(
                      restored,
                      snapshot,
                      %{
                        title: "must roll back",
                        asset_refs: [%{asset_id: -1, usage: :attachment}]
                      },
                      actor,
                      restored.revision,
                      community.id
                    ) do
                 {:error, reason} -> Repo.rollback(reason)
                 result -> result
               end
             end)

    after_failure = Repo.get!(ArticleWorkingCopy, restored.id)
    assert after_failure.revision == restored.revision
    assert after_failure.title == "Restored"
    assert CMS.Articles.Body.document(after_failure).xml == "<xml>saved</xml>"
    assert {:ok, ^restored_content} = ContentState.load(after_failure)

    assert {:error, :source_revision_conflict} =
             Repo.transaction(fn ->
               case Store.save_stored_body_loaded(
                      restored,
                      edited,
                      %{},
                      actor,
                      restored.revision,
                      community.id
                    ) do
                 {:error, reason} -> Repo.rollback(reason)
                 result -> result
               end
             end)

    assert {:error, :revision_conflict} =
             Repo.transaction(fn ->
               case Store.save_stored_body_loaded(
                      edited,
                      snapshot,
                      %{},
                      actor,
                      edited.revision,
                      community.id
                    ) do
                 {:error, reason} -> Repo.rollback(reason)
                 result -> result
               end
             end)

    assert {:ok, :pass} =
             Repo.transaction(fn ->
               other =
                 %Article{}
                 |> Article.changeset(%{thread: :doc, author_id: author.id})
                 |> Repo.insert!()

               {:ok, other_work} =
                 Store.create_loaded(
                   other,
                   %{scope_type: :default, scope_id: other.id, title: "Other"},
                   actor,
                   community.id
                 )

               assert {:error, :body_source_owner_mismatch} =
                        Store.save_stored_body_loaded(
                          other_work,
                          snapshot,
                          %{},
                          actor,
                          other_work.revision,
                          community.id
                        )

               assert Repo.get!(ArticleWorkingCopy, other_work.id).revision == other_work.revision
               :pass
             end)
  end

  test "copies saved bodies in either WorkingCopy ID order" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)
    author = Repo.get_by!(Author, user_id: actor.id)

    assert {:ok, :pass} =
             Repo.transaction(fn ->
               article =
                 %Article{}
                 |> Article.changeset(%{thread: :doc, author_id: author.id})
                 |> Repo.insert!()

               copies =
                 for text <- ["first", "second"] do
                   {:ok, work} =
                     Store.create_loaded(
                       article,
                       %{
                         scope_type: :workspace,
                         scope_id: Ecto.UUID.generate(),
                         title: text,
                         body_bag: body_bag(text)
                       },
                       actor,
                       community.id
                     )

                   work
                 end

               [lower, higher] = Enum.sort_by(copies, & &1.id)

               assert {:ok, higher_saved} =
                        Store.save_stored_body_loaded(
                          higher,
                          lower,
                          %{},
                          actor,
                          higher.revision,
                          community.id
                        )

               assert CMS.Articles.Body.document(higher_saved).json ==
                        CMS.Articles.Body.document(lower).json

               assert {:ok, lower_saved} =
                        Store.save_stored_body_loaded(
                          lower,
                          higher_saved,
                          %{},
                          actor,
                          lower.revision,
                          community.id
                        )

               assert CMS.Articles.Body.document(lower_saved).json ==
                        CMS.Articles.Body.document(higher_saved).json

               :pass
             end)
  end
end
