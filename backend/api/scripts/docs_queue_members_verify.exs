# Exercise Queue member writes only against a disposable B0 test database.
import Ecto.Query
import ExUnit.Assertions
import GroupherServer.Support.Factory

alias Ecto.Adapters.SQL.Sandbox
alias GroupherServer.{CMS, Repo}
alias CMS.Articles.WorkingCopy.Snapshotter
alias CMS.Articles.WorkingCopy.Deleter
alias CMS.Articles.WorkingCopy.Store, as: WorkingCopyStore
alias CMS.DocTree.Publish.Queue
alias CMS.DocTree.Publish.{AlignDefault, ResolveConflict, SelectPublic}

alias CMS.Model.{
  Article,
  ArticleBinding,
  ArticlePublic,
  ArticleAssetRef,
  ArticleSnapshot,
  ArticleWorkingCopy,
  ArticleWorkingCopyDoc,
  Author,
  CommunityAsset,
  CommunityTag,
  CommunityTagGroup,
  CoverEditWorkingCopy,
  DocsPostPublishConflict,
  DocsLifecycle,
  DocsQueueArticle,
  DocsQueueArticleContributor
}

[[database]] = Repo.query!("SELECT current_database()").rows
expected = System.get_env("DOCS_B0_DISPOSABLE_DATABASE")

unless Mix.env() == :test and is_binary(expected) and expected == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "Queue member exercise requires an explicitly named disposable test database"
end

{:ok, actor} = db_insert(:user)
{:ok, site} = db_insert(:community)
{:ok, other_site} = db_insert(:community)
author = Repo.insert!(%Author{user_id: actor.id})
{:ok, queue} = Repo.transact(fn -> Queue.lock_or_create(site) end)

make_doc = fn owner ->
  Repo.transact(fn ->
    with {:ok, article} <-
           %Article{} |> Article.changeset(%{thread: :doc, author_id: author.id}) |> Repo.insert(),
         {:ok, _} <-
           %ArticleBinding{}
           |> ArticleBinding.changeset(%{article_id: article.id, community_id: owner.id})
           |> Repo.insert(),
         {:ok, default} <-
           %ArticleWorkingCopy{}
           |> ArticleWorkingCopy.changeset(%{
             article_id: article.id,
             scope_kind: :default,
             scope_id: article.id,
             revision: 1,
             title: "Document",
             digest: "",
             body: %{
               article_id: article.id,
               type: :working_copy,
               json:
                 Jason.encode!([%{"type" => "p", "children" => [%{"text" => "Fixture content"}]}]),
               schema_version: 1,
               markdown: "Fixture content",
               html: "<p>Fixture content</p>",
               markdown_toc: %{},
               plain_text: "Fixture content",
               thumbnail: %{}
             },
             created_by_id: actor.id,
             updated_by_id: actor.id
           })
           |> Repo.insert(),
         {:ok, _} <-
           %ArticleWorkingCopyDoc{}
           |> ArticleWorkingCopyDoc.changeset(%{working_copy_id: default.id})
           |> Repo.insert(),
         {:ok, _} <-
           %DocsLifecycle{}
           |> DocsLifecycle.changeset(%{
             community_id: owner.id,
             article_id: article.id,
             default_working_copy_id: default.id,
             changed_at: DateTime.utc_now(:second)
           })
           |> Repo.insert(),
         {:ok, snapshot} <-
           Snapshotter.freeze_in_transaction(default.id, 1, actor, Ecto.UUID.generate()),
         {:ok, copy} <-
           Snapshotter.fork_snapshot_in_transaction(
             snapshot.id,
             %{article_id: article.id, scope_kind: :workspace, scope_id: queue.id},
             actor
           ) do
      {:ok,
       %{
         article_id: article.id,
         working_copy_id: copy.id,
         source_snapshot_id: snapshot.id,
         default_revision: 1
       }}
    end
  end)
end

{:ok, first} = make_doc.(site)
{:ok, second} = make_doc.(site)
{:ok, foreign} = make_doc.(other_site)

assert {:error, :invalid_queue_members} =
         Repo.transact(fn -> Queue.add_many(site, queue, 0, [first, first], actor) end)

assert {:error, :invalid_doc_binding} =
         Repo.transact(fn -> Queue.add_many(site, queue, 0, [first, foreign], actor) end)

assert {:error, {:default_revision_conflict, first_article_id, 1}} =
         Repo.transact(fn ->
           Queue.add_many(site, queue, 0, [%{first | default_revision: 2}], actor)
         end)

assert first_article_id == first.article_id

assert {:error, :invalid_queue_member_owner} =
         Repo.transact(fn ->
           Queue.add_many(
             site,
             queue,
             0,
             [%{first | source_snapshot_id: second.source_snapshot_id}],
             actor
           )
         end)

assert {:ok, queue_snapshot} =
         Repo.transact(fn ->
           Snapshotter.freeze_in_transaction(
             first.working_copy_id,
             1,
             actor,
             Ecto.UUID.generate()
           )
         end)

assert {:error, :invalid_queue_member_owner} =
         Repo.transact(fn ->
           Queue.add_many(
             site,
             queue,
             0,
             [%{first | source_snapshot_id: queue_snapshot.id}],
             actor
           )
         end)

assert {:error, :transaction_required} = Queue.add_many(site, queue, 0, [first], actor)

assert {:error, :invalid_queue_actor} =
         Repo.transact(fn ->
           Queue.add_many(site, queue, 0, [first], %{actor | id: 9_000_000_000})
         end)

assert Repo.aggregate(from(m in DocsQueueArticle, where: m.queue_id == ^queue.id), :count) == 0
assert {:ok, %{queue_revision: 0}} = Queue.read(site)

copy = Repo.get!(ArticleWorkingCopy, first.working_copy_id)

{:ok, _} = copy |> Ecto.Changeset.change(%{scope_id: Ecto.UUID.generate()}) |> Repo.update()

assert {:error, :invalid_queue_member_owner} =
         Repo.transact(fn -> Queue.add_many(site, queue, 0, [first], actor) end)

{:ok, _} =
  Repo.get!(ArticleWorkingCopy, copy.id)
  |> Ecto.Changeset.change(%{scope_id: queue.id})
  |> Repo.update()

copy = Repo.get!(ArticleWorkingCopy, copy.id)
{:ok, _} = copy |> Ecto.Changeset.change(%{title: "Not the source"}) |> Repo.update()

assert {:error, :queue_copy_not_fork_of_source} =
         Repo.transact(fn -> Queue.add_many(site, queue, 0, [first], actor) end)

{:ok, _} =
  Repo.get!(ArticleWorkingCopy, copy.id)
  |> Ecto.Changeset.change(%{title: "Document"})
  |> Repo.update()

assert {:error, :injected_failure} =
         Repo.transaction(fn ->
           assert {:ok, _} = Queue.add_many(site, queue, 0, [first, second], actor)
           Repo.rollback(:injected_failure)
         end)

assert Repo.aggregate(from(m in DocsQueueArticle, where: m.queue_id == ^queue.id), :count) == 0

assert Repo.aggregate(
         from(c in DocsQueueArticleContributor, where: c.queue_id == ^queue.id),
         :count
       ) == 0

assert {:ok, %{queue_revision: 0}} = Queue.read(site)

assert {:ok, %{queue: updated, members: members}} =
         Repo.transact(fn -> Queue.add_many(site, queue, 0, [second, first], actor) end)

assert updated.queue_revision == 1
assert Enum.map(members, & &1.article_id) == Enum.sort([first.article_id, second.article_id])
assert Enum.all?(members, &(&1.enqueued_by_id == actor.id))

assert Repo.aggregate(
         from(c in DocsQueueArticleContributor,
           where: c.queue_id == ^queue.id and c.user_id == ^actor.id
         ),
         :count
       ) == 2

assert {:error, {:queue_version_conflict, :queue_revision, 1}} =
         Repo.transact(fn -> Queue.add_many(site, queue, 0, [first], actor) end)

assert {:error, :already_enqueued} =
         Repo.transact(fn -> Queue.add_many(site, queue, 1, [first], actor) end)

assert {:ok, %{queue_revision: 1}} = Queue.read(site)

{:ok, third} = make_doc.(site)
default = Repo.get_by!(ArticleWorkingCopy, article_id: third.article_id, scope_kind: :default)
parent = self()

writer =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transaction(fn ->
        assert {:ok, _} =
                 WorkingCopyStore.save_loaded(
                   default,
                   %{title: "Concurrent default edit"},
                   actor,
                   1,
                   site.id
                 )

        send(parent, {:default_written, self()})

        receive do
          :commit -> :committed
        after
          10_000 -> Repo.rollback(:barrier_timeout)
        end
      end)
    end)
  end)

assert_receive {:default_written, writer_pid}, 10_000

enqueue =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transact(fn ->
        send(parent, :enqueue_attempting)
        Queue.add_many(site, queue, 1, [third], actor)
      end)
    end)
  end)

assert_receive :enqueue_attempting, 10_000
assert Task.yield(enqueue, 100) == nil
send(writer_pid, :commit)
assert {:ok, :committed} = Task.await(writer, 10_000)
assert {:error, {:default_revision_conflict, third_article_id, 2}} = Task.await(enqueue, 10_000)
assert third_article_id == third.article_id
assert {:ok, %{queue_revision: 1}} = Queue.read(site)
refute Repo.get_by(DocsQueueArticle, queue_id: queue.id, article_id: third.article_id)

{:ok, editor} = db_insert(:user)

assert {:error, {:queue_version_conflict, :queue_revision, 1}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 0, first.article_id, 1, %{title: "Bad"}, editor)
         end)

assert {:error, {:queue_work_revision_conflict, _, 1}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 1, first.article_id, 2, %{title: "Bad"}, editor)
         end)

assert {:error, _} =
         Repo.transact(fn ->
           Queue.save(
             site,
             queue,
             1,
             first.article_id,
             1,
             %{subtitle: "Rollback", title: nil},
             editor
           )
         end)

assert Repo.get_by!(ArticleWorkingCopyDoc, working_copy_id: first.working_copy_id).subtitle == nil
assert Repo.get!(ArticleWorkingCopy, first.working_copy_id).revision == 1
assert {:ok, %{queue_revision: 1}} = Queue.read(site)

refute Repo.get_by(DocsQueueArticleContributor,
         queue_id: queue.id,
         article_id: first.article_id,
         user_id: editor.id
       )

assert {:ok,
        %{queue: %{queue_revision: 2}, working_copy: %{revision: 2}, changed_fields: [:title]}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 1, first.article_id, 1, %{title: "Queue edit"}, editor)
         end)

assert {:ok, %{added?: false}} =
         Repo.transact(fn ->
           Queue.record_contribution(site, queue, 2, first.article_id, editor)
         end)

assert {:ok, %{queue_revision: 2}} = Queue.read(site)

assert Repo.aggregate(
         from(c in DocsQueueArticleContributor,
           where: c.queue_id == ^queue.id and c.article_id == ^first.article_id
         ),
         :count
       ) == 2

ids = [first.article_id, second.article_id]
operation = %{"kind" => "dequeue", "article_ids" => Enum.sort(ids)}

assert {:error, {:discard_confirmation_required, %{documents: [dirty], confirmation: proof}}} =
         Repo.transact(fn -> Queue.remove_many(site, queue, 2, ids, operation) end)

assert dirty["article_id"] == first.article_id
assert dirty["exclusive_fields"] == ["title"]

assert {:error, :stale_discard_confirmation} =
         Repo.transact(fn ->
           Queue.remove_many(site, queue, 2, ids, %{operation | "kind" => "delete_node"}, proof)
         end)

first_d = Repo.get_by!(ArticleWorkingCopy, article_id: first.article_id, scope_kind: :default)

assert {:ok, _} =
         Repo.transact(fn ->
           WorkingCopyStore.save_loaded(
             first_d,
             %{title: "Later D edit"},
             actor,
             first_d.revision,
             site.id
           )
         end)

assert {:error, :stale_discard_confirmation} =
         Repo.transact(fn -> Queue.remove_many(site, queue, 2, ids, operation, proof) end)

assert {:error, {:discard_confirmation_required, %{documents: [new_dirty], confirmation: proof}}} =
         Repo.transact(fn -> Queue.remove_many(site, queue, 2, ids, operation) end)

assert new_dirty["default_revision"] == first_d.revision + 1

Repo.query!(
  "CREATE TABLE cms.docs_b0_dequeue_guard (work_id uuid PRIMARY KEY REFERENCES cms.article_working_copies(id) ON DELETE RESTRICT)"
)

guarded = Enum.max_by([first, second], & &1.article_id)

Repo.query!("INSERT INTO cms.docs_b0_dequeue_guard(work_id) VALUES ($1)", [
  Ecto.UUID.dump!(guarded.working_copy_id)
])

assert {:error, :work_in_use} =
         Repo.transact(fn -> Queue.remove_many(site, queue, 2, ids, operation, proof) end)

assert Repo.aggregate(from(m in DocsQueueArticle, where: m.queue_id == ^queue.id), :count) == 2
assert Repo.get!(ArticleWorkingCopy, first.working_copy_id)
assert {:ok, %{queue_revision: 2}} = Queue.read(site)
Repo.query!("DROP TABLE cms.docs_b0_dequeue_guard")

assert {:ok, %{queue: %{queue_revision: 3}}} =
         Repo.transact(fn -> Queue.remove_many(site, queue, 2, ids, operation, proof) end)

refute Repo.get(ArticleWorkingCopy, first.working_copy_id)
refute Repo.get(ArticleWorkingCopy, second.working_copy_id)
assert Repo.get_by!(ArticleWorkingCopy, article_id: first.article_id, scope_kind: :default)
assert Repo.get_by!(ArticleWorkingCopy, article_id: second.article_id, scope_kind: :default)
assert Repo.get!(ArticleSnapshot, first.source_snapshot_id)
assert Repo.get!(ArticleSnapshot, second.source_snapshot_id)

assert Repo.aggregate(
         from(c in DocsQueueArticleContributor,
           where: c.queue_id == ^queue.id and c.article_id == ^first.article_id
         ),
         :count
       ) == 0

{:ok, fourth} = make_doc.(site)
assert {:ok, _} = Repo.transact(fn -> Queue.add_many(site, queue, 3, [fourth], actor) end)
fourth_q = Repo.get!(ArticleWorkingCopy, fourth.working_copy_id)
fourth_d = Repo.get_by!(ArticleWorkingCopy, article_id: fourth.article_id, scope_kind: :default)

{:ok, no_op_editor} = db_insert(:user)

assert {:ok, %{queue: %{queue_revision: 5}, working_copy: %{revision: 2}, changed_fields: []}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 4, fourth.article_id, 1, %{title: "Document"}, no_op_editor)
         end)

refute Repo.get_by(DocsQueueArticleContributor,
         queue_id: queue.id,
         article_id: fourth.article_id,
         user_id: no_op_editor.id
       )

assert {:ok, :saved} =
         Repo.transact(fn ->
           with {:ok, _} <-
                  Queue.save(site, queue, 5, fourth.article_id, 2, %{title: "Same"}, actor),
                {:ok, _} <-
                  WorkingCopyStore.save_loaded(fourth_d, %{title: "Same"}, actor, 1, site.id) do
             {:ok, :saved}
           end
         end)

assert {:ok, %{queue: %{queue_revision: 7}}} =
         Repo.transact(fn ->
           Queue.remove_many(site, queue, 6, [fourth.article_id], %{
             "kind" => "dequeue",
             "article_ids" => [fourth.article_id]
           })
         end)

assert Repo.get!(ArticleWorkingCopy, fourth_d.id).title == "Same"
refute Repo.get(ArticleWorkingCopy, fourth_q.id)

{:ok, fifth} = make_doc.(site)
assert {:ok, _} = Repo.transact(fn -> Queue.add_many(site, queue, 7, [fifth], actor) end)

first_save =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transaction(fn ->
        assert {:ok, _} =
                 Queue.save(site, queue, 8, fifth.article_id, 1, %{title: "First"}, editor)

        send(parent, {:first_queue_save, self()})

        receive do
          :commit -> :committed
        after
          10_000 -> Repo.rollback(:barrier_timeout)
        end
      end)
    end)
  end)

assert_receive {:first_queue_save, save_pid}, 10_000

second_save =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transact(fn ->
        send(parent, :second_queue_save_attempting)
        Queue.save(site, queue, 8, fifth.article_id, 1, %{title: "Second"}, actor)
      end)
    end)
  end)

assert_receive :second_queue_save_attempting, 10_000
assert Task.yield(second_save, 100) == nil
send(save_pid, :commit)
assert {:ok, :committed} = Task.await(first_save, 10_000)
assert {:error, {:queue_version_conflict, :queue_revision, 9}} = Task.await(second_save, 10_000)
assert %{title: "First", revision: 2} = Repo.get!(ArticleWorkingCopy, fifth.working_copy_id)
assert {:ok, %{queue_revision: 9}} = Queue.read(site)

asset =
  %CommunityAsset{}
  |> CommunityAsset.changeset(%{
    community_id: site.id,
    uploader_id: actor.id,
    url: "https://assets.example.test/queue-#{Ecto.UUID.generate()}.png",
    size_bytes: 10
  })
  |> Repo.insert!()

{:ok, sixth} = make_doc.(site)
assert {:ok, _} = Repo.transact(fn -> Queue.add_many(site, queue, 9, [sixth], actor) end)

cover = %{
  canvas_width: 1200,
  canvas_height: 630,
  light: %{"background" => "white"},
  dark: %{"background" => "black"}
}

assert {:ok, %{queue: %{queue_revision: 11}, working_copy: saved, changed_fields: changed}} =
         Repo.transact(fn ->
           Queue.save(
             site,
             queue,
             10,
             sixth.article_id,
             1,
             %{cover_edit: cover, asset_refs: [%{asset_id: asset.id, usage: :attachment}]},
             editor
           )
         end)

assert changed == [:cover_edit, :asset_refs]
assert Repo.get!(CoverEditWorkingCopy, saved.cover_edit_working_copy_id).canvas_width == 1200

assert [%ArticleAssetRef{asset_id: asset_id}] =
         Repo.all(from(r in ArticleAssetRef, where: r.working_copy_id == ^saved.id))

assert asset_id == asset.id

sixth_default =
  Repo.get_by!(ArticleWorkingCopy, article_id: sixth.article_id, scope_kind: :default)

assert Repo.all(
         from(r in ArticleAssetRef,
           where:
             r.working_copy_id == ^sixth_default.id or r.snapshot_id == ^sixth.source_snapshot_id
         )
       ) == []

{:ok, cover_editor} = db_insert(:user)

assert {:ok,
        %{queue: %{queue_revision: 12}, working_copy: cover_saved, changed_fields: [:cover_url]}} =
         Repo.transact(fn ->
           Queue.save(
             site,
             queue,
             11,
             sixth.article_id,
             2,
             %{cover_asset_id: asset.id},
             cover_editor
           )
         end)

assert cover_saved.revision == 3

assert Repo.get_by!(ArticleAssetRef, working_copy_id: saved.id, usage: :cover).asset_id ==
         asset.id

assert Repo.get_by!(ArticleAssetRef, working_copy_id: saved.id, usage: :attachment).asset_id ==
         asset.id

assert Repo.get_by!(DocsQueueArticleContributor,
         queue_id: queue.id,
         article_id: sixth.article_id,
         user_id: cover_editor.id
       )

group =
  %CommunityTagGroup{}
  |> CommunityTagGroup.changeset(%{thread: :doc, title: "Queue tags", community_id: site.id})
  |> Repo.insert!()

tag =
  %CommunityTag{}
  |> CommunityTag.changeset(%{
    thread: :doc,
    title: "Queue tag",
    slug: "queue-tag",
    color: :cyan,
    author_id: author.id,
    community_id: site.id,
    group_id: group.id
  })
  |> Repo.insert!()

{:ok, tag_editor} = db_insert(:user)

assert {:ok,
        %{queue: %{queue_revision: 13}, working_copy: %{revision: 4}, changed_fields: [:tags]}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 12, sixth.article_id, 3, %{tag_ids: [tag.id]}, tag_editor)
         end)

assert {:ok, [tag_id]} =
         CMS.Articles.working_copy_tag_ids(Repo.get!(ArticleWorkingCopy, saved.id))

assert tag_id == tag.id
assert {:ok, []} = CMS.Articles.working_copy_tag_ids(sixth_default)

assert {:ok, []} =
         CMS.Articles.snapshot_tag_ids(Repo.get!(ArticleSnapshot, sixth.source_snapshot_id))

assert Repo.get_by!(DocsQueueArticleContributor,
         queue_id: queue.id,
         article_id: sixth.article_id,
         user_id: tag_editor.id
       )

assert {:error, _} =
         Repo.transact(fn ->
           Queue.save(
             site,
             queue,
             13,
             sixth.article_id,
             4,
             %{
               cover_edit: %{cover | canvas_width: 800},
               asset_refs: [%{asset_id: 9_000_000_000, usage: :attachment}]
             },
             editor
           )
         end)

assert Repo.get!(CoverEditWorkingCopy, saved.cover_edit_working_copy_id).canvas_width == 1200

assert Repo.get_by!(ArticleAssetRef, working_copy_id: saved.id, usage: :cover).asset_id ==
         asset_id

assert Repo.get_by!(ArticleAssetRef, working_copy_id: saved.id, usage: :attachment).asset_id ==
         asset_id

assert Repo.get!(ArticleWorkingCopy, saved.id).revision == 4
assert {:ok, %{queue_revision: 13}} = Queue.read(site)

assert {:error, :injected_overflow} =
         Repo.transaction(fn ->
           {1, nil} =
             Repo.update_all(from(q in CMS.Model.DocsPublishQueue, where: q.id == ^queue.id),
               set: [queue_revision: 9_223_372_036_854_775_807]
             )

           assert {:error, :queue_version_exhausted} =
                    Queue.save(
                      site,
                      queue,
                      9_223_372_036_854_775_807,
                      sixth.article_id,
                      4,
                      %{title: "Must roll back"},
                      no_op_editor
                    )

           Repo.rollback(:injected_overflow)
         end)

assert Repo.get!(ArticleWorkingCopy, saved.id).revision == 4
assert Repo.get!(ArticleWorkingCopy, saved.id).title == "Document"

refute Repo.get_by(DocsQueueArticleContributor,
         queue_id: queue.id,
         article_id: sixth.article_id,
         user_id: no_op_editor.id
       )

assert {:ok, %{queue_revision: 13}} = Queue.read(site)

assert {:ok, %{queue: %{queue_revision: 13}, working_copy: %{revision: 4}, changed_fields: []}} =
         Repo.transact(fn ->
           Queue.merge(site, queue, 13, sixth.article_id, 1, 4, %{}, actor, Ecto.UUID.generate())
         end)

assert {:ok, updated_default} =
         Repo.transact(fn ->
           WorkingCopyStore.save_loaded(
             sixth_default,
             %{title: "Default title"},
             actor,
             1,
             site.id
           )
         end)

assert {:ok, %{queue: %{queue_revision: 14}, working_copy: merged, changed_fields: [:title]}} =
         Repo.transact(fn ->
           Queue.merge(site, queue, 13, sixth.article_id, 2, 4, %{}, actor, Ecto.UUID.generate())
         end)

assert merged.title == "Default title"
assert merged.revision == 5

assert Repo.get_by!(ArticleAssetRef, working_copy_id: merged.id, usage: :cover).asset_id ==
         asset.id

assert {:ok, [tag_id]} = CMS.Articles.working_copy_tag_ids(merged)
assert tag_id == tag.id

assert {:ok, %{working_copy: %{revision: 6}}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 14, sixth.article_id, 5, %{title: "Q title"}, editor)
         end)

assert {:ok, updated_default} =
         Repo.transact(fn ->
           WorkingCopyStore.save_loaded(updated_default, %{title: "D title"}, actor, 2, site.id)
         end)

snapshot_count =
  Repo.aggregate(from(s in ArticleSnapshot, where: s.article_id == ^sixth.article_id), :count)

assert {:error, {:default_revision_conflict, _, 3}} =
         Repo.transact(fn ->
           Queue.merge(site, queue, 15, sixth.article_id, 2, 6, %{}, actor, Ecto.UUID.generate())
         end)

assert {:error, {:queue_work_revision_conflict, _, 6}} =
         Repo.transact(fn ->
           Queue.merge(site, queue, 15, sixth.article_id, 3, 5, %{}, actor, Ecto.UUID.generate())
         end)

assert {:error, {:queue_version_conflict, :queue_revision, 15}} =
         Repo.transact(fn ->
           Queue.merge(site, queue, 14, sixth.article_id, 3, 6, %{}, actor, Ecto.UUID.generate())
         end)

assert {:error,
        {:merge_conflict,
         %{fields: [:title], queue_revision: 15, default_revision: 3, working_copy_revision: 6}}} =
         Repo.transact(fn ->
           Queue.merge(site, queue, 15, sixth.article_id, 3, 6, %{}, actor, Ecto.UUID.generate())
         end)

assert Repo.aggregate(
         from(s in ArticleSnapshot, where: s.article_id == ^sixth.article_id),
         :count
       ) == snapshot_count

assert {:ok, %{queue_revision: 15}} = Queue.read(site)

assert {:ok, %{queue: %{queue_revision: 16}, working_copy: resolved, changed_fields: [:title]}} =
         Repo.transact(fn ->
           Queue.merge(
             site,
             queue,
             15,
             sixth.article_id,
             3,
             6,
             %{title: :source},
             actor,
             Ecto.UUID.generate()
           )
         end)

assert resolved.title == "D title"
assert resolved.revision == 7

assert {:ok, _} =
         Repo.transact(fn ->
           WorkingCopyStore.save_loaded(updated_default, %{title: "D title"}, actor, 3, site.id)
         end)

assert {:ok,
        %{
          queue: %{queue_revision: 16},
          working_copy: %{revision: 7},
          member: rebased,
          changed_fields: []
        }} =
         Repo.transact(fn ->
           Queue.merge(site, queue, 16, sixth.article_id, 4, 7, %{}, actor, Ecto.UUID.generate())
         end)

assert Repo.get!(ArticleSnapshot, rebased.source_snapshot_id).source_revision == 4

default_before_race = Repo.get!(ArticleWorkingCopy, sixth_default.id)

default_writer =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transaction(fn ->
        assert {:ok, _} =
                 WorkingCopyStore.save_loaded(
                   default_before_race,
                   %{title: "Concurrent default"},
                   actor,
                   4,
                   site.id
                 )

        send(parent, {:merge_default_written, self()})

        receive do
          :commit -> :committed
        after
          10_000 -> Repo.rollback(:barrier_timeout)
        end
      end)
    end)
  end)

assert_receive {:merge_default_written, default_writer_pid}, 10_000

waiting_merge =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transact(fn ->
        send(parent, :merge_waiting_for_default)
        Queue.merge(site, queue, 16, sixth.article_id, 4, 7, %{}, editor, Ecto.UUID.generate())
      end)
    end)
  end)

assert_receive :merge_waiting_for_default, 10_000
assert Task.yield(waiting_merge, 100) == nil
send(default_writer_pid, :commit)
assert {:ok, :committed} = Task.await(default_writer, 10_000)
assert {:error, {:default_revision_conflict, _, 5}} = Task.await(waiting_merge, 10_000)
assert {:ok, %{queue_revision: 16}} = Queue.read(site)
assert Repo.get!(ArticleWorkingCopy, resolved.id).revision == 7

assert Repo.get_by!(DocsQueueArticle, queue_id: queue.id, article_id: sixth.article_id).source_snapshot_id ==
         rebased.source_snapshot_id

queue_writer =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transaction(fn ->
        assert {:ok, _} =
                 Queue.save(
                   site,
                   queue,
                   16,
                   sixth.article_id,
                   7,
                   %{title: "Concurrent Q"},
                   editor
                 )

        send(parent, {:merge_queue_written, self()})

        receive do
          :commit -> :committed
        after
          10_000 -> Repo.rollback(:barrier_timeout)
        end
      end)
    end)
  end)

assert_receive {:merge_queue_written, queue_writer_pid}, 10_000

waiting_merge =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transact(fn ->
        send(parent, :merge_waiting_for_queue)
        Queue.merge(site, queue, 16, sixth.article_id, 5, 7, %{}, actor, Ecto.UUID.generate())
      end)
    end)
  end)

assert_receive :merge_waiting_for_queue, 10_000
assert Task.yield(waiting_merge, 100) == nil
send(queue_writer_pid, :commit)
assert {:ok, :committed} = Task.await(queue_writer, 10_000)

assert {:error, {:queue_version_conflict, :queue_revision, 17}} =
         Task.await(waiting_merge, 10_000)

assert %{revision: 8, title: "Concurrent Q"} = Repo.get!(ArticleWorkingCopy, resolved.id)

assert Repo.get_by!(DocsQueueArticle, queue_id: queue.id, article_id: sixth.article_id).source_snapshot_id ==
         rebased.source_snapshot_id

body_json =
  Jason.encode!([%{"id" => "body-node", "type" => "p", "children" => [%{"text" => "New body"}]}])

body_bag = %{
  json: body_json,
  markdown: "New body",
  html: "<p>New body</p>",
  toc: [],
  plain_text: "New body",
  digest: "New body",
  body_hash: :crypto.hash(:sha256, body_json) |> Base.encode16(case: :lower),
  schema_version: 2,
  thumbnail: %{version: 1, blocks: [%{type: "paragraph", text: "New body"}]}
}

assert {:ok, new_default} =
         Repo.transact(fn ->
           WorkingCopyStore.save_loaded(
             Repo.get!(ArticleWorkingCopy, sixth_default.id),
             %{body_bag: body_bag},
             actor,
             5,
             site.id
           )
         end)

assert {:ok,
        %{
          queue: %{queue_revision: 18},
          working_copy: body_merged,
          member: member,
          changed_fields: [:body]
        }} =
         Repo.transact(fn ->
           Queue.merge(
             site,
             queue,
             17,
             sixth.article_id,
             6,
             8,
             %{title: :target},
             actor,
             Ecto.UUID.generate()
           )
         end)

assert body_merged.title == "Concurrent Q"

assert CMS.Articles.Body.document(body_merged).json ==
         CMS.Articles.Body.document(new_default).json

assert CMS.Articles.Body.document(body_merged).markdown ==
         CMS.Articles.Body.document(new_default).markdown

assert CMS.Articles.Body.document(body_merged).html ==
         CMS.Articles.Body.document(new_default).html

assert CMS.Articles.Body.document(body_merged).schema_version ==
         CMS.Articles.Body.document(new_default).schema_version

assert body_merged.revision == 9
assert Repo.get!(ArticleSnapshot, member.source_snapshot_id).source_revision == 6

assert Repo.get_by!(ArticleAssetRef, working_copy_id: body_merged.id, usage: :cover).asset_id ==
         asset.id

assert {:ok, [tag_id]} = CMS.Articles.working_copy_tag_ids(body_merged)
assert tag_id == tag.id

assert {:error, :release_rollback} =
         Repo.transaction(fn ->
           {:ok, queue_snapshot} =
             Snapshotter.freeze_in_transaction(body_merged.id, 9, actor, Ecto.UUID.generate())

           assert {:error, {:queue_version_conflict, :queue_revision, 18}} =
                    SelectPublic.select(
                      site,
                      queue,
                      17,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:error, {:queue_work_revision_conflict, _, 9}} =
                    SelectPublic.select(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      8,
                      queue_snapshot.id,
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:error, :doc_public_source_mismatch} =
                    SelectPublic.select(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      member.source_snapshot_id,
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok, %{public: selected, first_publish?: true}} =
                    SelectPublic.select(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert selected.snapshot_id == queue_snapshot.id
           assert selected.title == "Concurrent Q"

           assert {:ok, %{status: :clean, working_copy: aligned}} =
                    AlignDefault.align(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      actor
                    )

           assert aligned.id == new_default.id and aligned.revision == 6
           assert Repo.get!(ArticleWorkingCopy, aligned.id).revision == 6

           assert {:error, :revision_conflict} =
                    WorkingCopyStore.save_loaded(
                      new_default,
                      %{title: "Stale"},
                      actor,
                      5,
                      site.id
                    )

           assert {:ok, %{status: :clean, working_copy: %{revision: 6}}} =
                    AlignDefault.align(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      actor
                    )

           assert {:error, :public_conflict} =
                    SelectPublic.select(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok, %{first_publish?: false}} =
                    SelectPublic.select(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      queue_snapshot.id,
                      actor,
                      DateTime.utc_now(:second)
                    )

           Repo.rollback(:release_rollback)
         end)

assert Repo.get(ArticlePublic, sixth.article_id) == nil

assert Repo.get_by(ArticleSnapshot, source_working_copy_id: body_merged.id, source_revision: 9) ==
         nil

assert {:error, :conflict_rollback} =
         Repo.transaction(fn ->
           assert {:ok, default} =
                    WorkingCopyStore.save_loaded(
                      new_default,
                      %{title: "Different D", subtitle: "Unpublished D subtitle"},
                      actor,
                      6,
                      site.id
                    )

           {:ok, queue_snapshot} =
             Snapshotter.freeze_in_transaction(body_merged.id, 9, actor, Ecto.UUID.generate())

           assert {:ok, _} =
                    SelectPublic.select(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok, %{status: :conflict, fields: [:title], default_revision: 7}} =
                    AlignDefault.align(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      actor
                    )

           assert Repo.get_by!(DocsPostPublishConflict,
                    community_id: site.id,
                    article_id: sixth.article_id
                  ).published_snapshot_id == queue_snapshot.id

           assert Repo.get!(ArticleWorkingCopy, default.id).title == "Different D"
           assert Repo.get!(ArticleWorkingCopy, default.id).revision == 7

           assert {:error, {:default_revision_conflict, _, 7}} =
                    ResolveConflict.resolve(
                      site,
                      sixth.article_id,
                      default.id,
                      6,
                      queue_snapshot.id,
                      %{},
                      actor
                    )

           assert {:error, {:merge_conflict, [:title]}} =
                    ResolveConflict.resolve(
                      site,
                      sixth.article_id,
                      default.id,
                      7,
                      queue_snapshot.id,
                      %{},
                      actor
                    )

           assert {:ok, %{working_copy: %{revision: 8, title: "Concurrent Q"} = resolved}} =
                    ResolveConflict.resolve(
                      site,
                      sixth.article_id,
                      default.id,
                      7,
                      queue_snapshot.id,
                      %{title: :source},
                      actor
                    )

           assert Repo.get_by(DocsPostPublishConflict,
                    community_id: site.id,
                    article_id: sixth.article_id
                  ) == nil

           assert {:ok, [tag_id]} = CMS.Articles.working_copy_tag_ids(resolved)
           assert tag_id == tag.id

           assert Repo.get_by!(ArticleAssetRef, working_copy_id: resolved.id, usage: :cover).asset_id ==
                    asset.id

           assert {:error, :revision_conflict} =
                    WorkingCopyStore.save_loaded(default, %{title: "Stale"}, actor, 7, site.id)

           Repo.rollback(:conflict_rollback)
         end)

assert {:error, :merge_alignment_rollback} =
         Repo.transaction(fn ->
           assert {:ok, _} =
                    WorkingCopyStore.save_loaded(
                      new_default,
                      %{subtitle: "D only"},
                      actor,
                      6,
                      site.id
                    )

           {:ok, queue_snapshot} =
             Snapshotter.freeze_in_transaction(body_merged.id, 9, actor, Ecto.UUID.generate())

           assert {:ok, _} =
                    SelectPublic.select(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      nil,
                      actor,
                      DateTime.utc_now(:second)
                    )

           assert {:ok, %{status: :merge, working_copy: aligned}} =
                    AlignDefault.align(
                      site,
                      queue,
                      18,
                      sixth.article_id,
                      9,
                      queue_snapshot.id,
                      actor
                    )

           assert aligned.revision == 8
           assert aligned.title == "Concurrent Q"

           assert Repo.get_by!(ArticleWorkingCopyDoc, working_copy_id: aligned.id).subtitle ==
                    "D only"

           Repo.rollback(:merge_alignment_rollback)
         end)

assert {:ok, _} =
         Repo.transact(fn ->
           WorkingCopyStore.save_loaded(
             new_default,
             %{subtitle: "Merge rollback"},
             actor,
             6,
             site.id
           )
         end)

{:ok, merge_editor} = db_insert(:user)

snapshot_count =
  Repo.aggregate(from(s in ArticleSnapshot, where: s.article_id == ^sixth.article_id), :count)

assert {:error, :merge_overflow_rollback} =
         Repo.transaction(fn ->
           {1, nil} =
             Repo.update_all(from(q in CMS.Model.DocsPublishQueue, where: q.id == ^queue.id),
               set: [queue_revision: 9_223_372_036_854_775_807]
             )

           assert {:error, :queue_version_exhausted} =
                    Queue.merge(
                      site,
                      queue,
                      9_223_372_036_854_775_807,
                      sixth.article_id,
                      7,
                      9,
                      %{},
                      merge_editor,
                      Ecto.UUID.generate()
                    )

           Repo.rollback(:merge_overflow_rollback)
         end)

assert Repo.get!(ArticleWorkingCopy, body_merged.id).revision == 9
assert Repo.get_by!(ArticleWorkingCopyDoc, working_copy_id: body_merged.id).subtitle == nil

assert Repo.get_by!(DocsQueueArticle, queue_id: queue.id, article_id: sixth.article_id).source_snapshot_id ==
         member.source_snapshot_id

assert Repo.aggregate(
         from(s in ArticleSnapshot, where: s.article_id == ^sixth.article_id),
         :count
       ) == snapshot_count

refute Repo.get_by(DocsQueueArticleContributor,
         queue_id: queue.id,
         article_id: sixth.article_id,
         user_id: merge_editor.id
       )

assert {:ok, %{queue_revision: 18}} = Queue.read(site)

batch =
  for _ <- 1..3 do
    {:ok, item} = make_doc.(site)
    item
  end
  |> Enum.sort_by(& &1.article_id)

[batch_first, batch_second, batch_blocked] = batch

for entry <- [batch_first, batch_second] do
  assert {:ok, :deleted} =
           Repo.transact(fn ->
             Deleter.delete_in_transaction(
               Repo.get!(Article, entry.article_id),
               Repo.get!(ArticleWorkingCopy, entry.working_copy_id)
             )
           end)
end

batch_default =
  Repo.get_by!(ArticleWorkingCopy, article_id: batch_first.article_id, scope_kind: :default)

assert {:ok, _} =
         Repo.transact(fn ->
           WorkingCopyStore.save_loaded(
             batch_default,
             %{title: "New snapshot"},
             actor,
             1,
             site.id
           )
         end)

enqueue_entries =
  Enum.map(batch, fn entry ->
    %{article_id: entry.article_id, default_revision: if(entry == batch_first, do: 2, else: 1)}
  end)

assert {:error, :invalid_queue_members} =
         Repo.transact(fn ->
           Queue.enqueue(
             site,
             queue,
             18,
             [hd(enqueue_entries), hd(enqueue_entries)],
             actor,
             Ecto.UUID.generate()
           )
         end)

assert {:error, {:default_revision_conflict, _, 2}} =
         Repo.transact(fn ->
           Queue.enqueue(
             site,
             queue,
             18,
             [%{article_id: batch_first.article_id, default_revision: 1}],
             actor,
             Ecto.UUID.generate()
           )
         end)

assert {:error, :scope_occupied} =
         Repo.transact(fn ->
           Queue.enqueue(site, queue, 18, enqueue_entries, actor, Ecto.UUID.generate())
         end)

assert {:error, :conflict_fixture_rollback} =
         Repo.transaction(fn ->
           %DocsPostPublishConflict{}
           |> DocsPostPublishConflict.changeset(%{
             community_id: site.id,
             article_id: batch_first.article_id,
             base_snapshot_id: batch_first.source_snapshot_id,
             published_snapshot_id: batch_first.source_snapshot_id,
             default_revision: 2
           })
           |> Repo.insert!()

           assert {:error, {:doc_post_publish_conflicts, [blocked]}} =
                    Queue.enqueue(site, queue, 18, enqueue_entries, actor, Ecto.UUID.generate())

           assert blocked == batch_first.article_id
           Repo.rollback(:conflict_fixture_rollback)
         end)

assert Repo.get_by(ArticleWorkingCopy, article_id: batch_first.article_id, scope_kind: :workspace) ==
         nil

assert Repo.get_by(ArticleWorkingCopy,
         article_id: batch_second.article_id,
         scope_kind: :workspace
       ) == nil

assert Repo.get_by(ArticleSnapshot, source_working_copy_id: batch_default.id, source_revision: 2) ==
         nil

assert {:ok, %{queue_revision: 18}} = Queue.read(site)

assert {:ok, :deleted} =
         Repo.transact(fn ->
           Deleter.delete_in_transaction(
             Repo.get!(Article, batch_blocked.article_id),
             Repo.get!(ArticleWorkingCopy, batch_blocked.working_copy_id)
           )
         end)

assert {:ok, %{queue: %{queue_revision: 19}, members: enqueued}} =
         Repo.transact(fn ->
           Queue.enqueue(
             site,
             queue,
             18,
             Enum.reverse(enqueue_entries),
             actor,
             Ecto.UUID.generate()
           )
         end)

assert Enum.map(enqueued, & &1.article_id) == Enum.map(batch, & &1.article_id)
assert length(enqueued) == 3

for member <- enqueued do
  copy = Repo.get!(ArticleWorkingCopy, member.working_copy_id)
  snapshot = Repo.get!(ArticleSnapshot, member.source_snapshot_id)
  assert copy.scope_kind == :workspace and copy.scope_id == queue.id and copy.revision == 1
  assert snapshot.article_id == member.article_id

  assert Repo.get_by!(DocsQueueArticleContributor,
           queue_id: queue.id,
           article_id: member.article_id,
           user_id: actor.id
         )
end

assert {:error, :already_enqueued} =
         Repo.transact(fn ->
           Queue.enqueue(site, queue, 19, enqueue_entries, actor, Ecto.UUID.generate())
         end)

{:ok, concurrent_entry} = make_doc.(site)

assert {:ok, :deleted} =
         Repo.transact(fn ->
           Deleter.delete_in_transaction(
             Repo.get!(Article, concurrent_entry.article_id),
             Repo.get!(ArticleWorkingCopy, concurrent_entry.working_copy_id)
           )
         end)

concurrent_default =
  Repo.get_by!(ArticleWorkingCopy, article_id: concurrent_entry.article_id, scope_kind: :default)

enqueue_writer =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transaction(fn ->
        assert {:ok, _} =
                 WorkingCopyStore.save_loaded(
                   concurrent_default,
                   %{title: "Concurrent enqueue D"},
                   actor,
                   1,
                   site.id
                 )

        send(parent, {:enqueue_default_written, self()})

        receive do
          :commit -> :committed
        after
          10_000 -> Repo.rollback(:barrier_timeout)
        end
      end)
    end)
  end)

assert_receive {:enqueue_default_written, enqueue_writer_pid}, 10_000

waiting_enqueue =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transact(fn ->
        send(parent, :enqueue_waiting_for_default)

        Queue.enqueue(
          site,
          queue,
          19,
          [%{article_id: concurrent_entry.article_id, default_revision: 1}],
          actor,
          Ecto.UUID.generate()
        )
      end)
    end)
  end)

assert_receive :enqueue_waiting_for_default, 10_000
assert Task.yield(waiting_enqueue, 100) == nil
send(enqueue_writer_pid, :commit)
assert {:ok, :committed} = Task.await(enqueue_writer, 10_000)
assert {:error, {:default_revision_conflict, _, 2}} = Task.await(waiting_enqueue, 10_000)

assert Repo.get_by(ArticleWorkingCopy,
         article_id: concurrent_entry.article_id,
         scope_kind: :workspace
       ) == nil

assert {:ok, %{queue_revision: 19}} = Queue.read(site)

IO.puts("Docs Queue member batch exercise passed")
