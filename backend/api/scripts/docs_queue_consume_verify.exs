# Exercise publication consumption only in an explicitly named disposable test database.
import Ecto.Query
import ExUnit.Assertions
import GroupherServer.Support.Factory

alias GroupherServer.{CMS, Repo}
alias CMS.Articles.WorkingCopy.{Snapshotter, Store}
alias CMS.DocTree.Publish.{AlignDefault, Queue, ResolveConflict, SelectPublic}

alias CMS.Model.{
  Article,
  ArticleBinding,
  ArticlePublic,
  ArticleSnapshot,
  ArticleWorkingCopy,
  Author,
  DocsPostPublishConflict,
  DocsLifecycle,
  DocsPublishQueue,
  DocsRelease,
  DocsReleaseArticle,
  DocsReleaseTreeSnapshot,
  DocsQueueArticle
}

[[database]] = Repo.query!("SELECT current_database()").rows
expected = System.get_env("DOCS_B0_DISPOSABLE_DATABASE")

unless Mix.env() == :test and is_binary(expected) and expected == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "Queue publication exercise requires an explicitly named disposable test database"
end

{:ok, actor} = db_insert(:user)
{:ok, site} = db_insert(:community)
author = Repo.insert!(%Author{user_id: actor.id})
{:ok, queue} = Repo.transact(fn -> Queue.lock_or_create(site) end)

body_json = Jason.encode!([%{"id" => "p", "type" => "p", "children" => [%{"text" => "Body"}]}])

body = %{
  json: body_json,
  markdown: "Body",
  html: "<p>Body</p>",
  toc: [],
  plain_text: "Body",
  digest: "Body",
  body_hash: :crypto.hash(:sha256, body_json) |> Base.encode16(case: :lower),
  schema_version: 2,
  thumbnail: %{version: 1, blocks: [%{type: "paragraph", text: "Body"}]}
}

docs =
  for index <- 1..2 do
    {:ok, result} =
      Repo.transact(fn ->
        article =
          %Article{} |> Article.changeset(%{thread: :doc, author_id: author.id}) |> Repo.insert!()

        %ArticleBinding{}
        |> ArticleBinding.changeset(%{article_id: article.id, community_id: site.id})
        |> Repo.insert!()

        {:ok, default} =
          Store.create_loaded(
            article,
            %{scope_kind: :default, scope_id: article.id, title: "Doc #{index}", body_bag: body},
            actor,
            site.id
          )

        %DocsLifecycle{}
        |> DocsLifecycle.changeset(%{
          community_id: site.id,
          article_id: article.id,
          default_working_copy_id: default.id,
          changed_at: DateTime.utc_now(:second)
        })
        |> Repo.insert!()

        {:ok, %{article: article, default: default}}
      end)

    result
  end

entries = Enum.map(docs, &%{article_id: &1.article.id, default_revision: 1})

assert {:ok, %{queue: %{queue_revision: 1}, members: members}} =
         Repo.transact(fn ->
           Queue.enqueue(site, queue, 0, entries, actor, Ecto.UUID.generate())
         end)

assert {:ok, %{queue: %{queue_revision: 2}}} =
         Repo.transact(fn ->
           Queue.save(site, queue, 1, hd(members).article_id, 1, %{title: "Q only"}, actor)
         end)

# The consumption primitive is exercised with a sealed fixture Release; the
# separate Release exercise checks plan construction and sealing end to end.
seal_release = fn publications ->
  now = DateTime.utc_now(:second)

  tree =
    %DocsReleaseTreeSnapshot{}
    |> DocsReleaseTreeSnapshot.changeset(%{
      community_id: site.id,
      tree_json: %{"version" => 1, "nodes" => []},
      created_at: now
    })
    |> Repo.insert!()

  release =
    %DocsRelease{}
    |> DocsRelease.changeset(%{
      community_id: site.id,
      tree_snapshot_id: tree.id,
      queue_revision: 2,
      plan_format_version: 1,
      published_by_id: actor.id,
      published_at: now
    })
    |> Repo.insert!()

  for publication <- publications do
    %DocsReleaseArticle{}
    |> DocsReleaseArticle.changeset(%{
      release_id: release.id,
      article_id: publication.article_id,
      snapshot_id: publication.snapshot_id,
      action: :publish
    })
    |> Repo.insert!()
  end

  release = release |> Ecto.Changeset.change(sealed: true) |> Repo.update!()

  Repo.get!(DocsPublishQueue, queue.id)
  |> Ecto.Changeset.change(public_release_id: release.id)
  |> Repo.update!()

  release
end

assert {:error, :release_rollback} =
         Repo.transaction(fn ->
           publications =
             for member <- members do
               copy = Repo.get!(ArticleWorkingCopy, member.working_copy_id)

               {:ok, snapshot} =
                 Snapshotter.freeze_in_transaction(
                   copy.id,
                   copy.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

               assert {:ok, _} =
                        SelectPublic.select(
                          site,
                          queue,
                          2,
                          member.article_id,
                          copy.revision,
                          snapshot.id,
                          nil,
                          actor,
                          DateTime.utc_now(:second)
                        )

               lifecycle = Repo.get_by!(DocsLifecycle, article_id: member.article_id)

               {:ok, _} =
                 CMS.DocTree.Publish.Lifecycle.published(
                   lifecycle,
                   true,
                   DateTime.utc_now(:second)
                 )

               %{
                 article_id: member.article_id,
                 snapshot_id: snapshot.id,
                 work_revision: copy.revision
               }
             end

           assert {:error, :docs_release_not_found} =
                    Queue.consume_release(site, queue, 2, 9_000_000_000, publications)

           release = seal_release.(publications)

           for publication <- publications do
             assert {:ok, %{status: status}} =
                      AlignDefault.align(
                        site,
                        queue,
                        2,
                        publication.article_id,
                        publication.work_revision,
                        publication.snapshot_id,
                        actor
                      )

             assert status == :clean
           end

           assert {:error, :docs_release_queue_mismatch} =
                    Queue.consume_release(site, queue, 2, release.id, [hd(publications)])

           wrong =
             List.update_at(
               publications,
               0,
               &%{&1 | snapshot_id: Enum.at(publications, 1).snapshot_id}
             )

           assert {:error, :docs_release_members_mismatch} =
                    Queue.consume_release(site, queue, 2, release.id, wrong)

           assert {:ok, %{queue: %{queue_revision: 3}}} =
                    Queue.consume_release(site, queue, 2, release.id, publications)

           for member <- members do
             assert Repo.get(ArticleWorkingCopy, member.working_copy_id) == nil

             refute Repo.get_by(DocsQueueArticle,
                      queue_id: queue.id,
                      article_id: member.article_id
                    )

             assert Repo.get!(ArticlePublic, member.article_id).snapshot_id
           end

           Repo.rollback(:release_rollback)
         end)

assert {:ok, %{queue_revision: 2}} = Queue.read(site)

for member <- members do
  assert Repo.get!(ArticleWorkingCopy, member.working_copy_id)
  assert Repo.get(ArticlePublic, member.article_id) == nil
  assert Repo.get_by(DocsQueueArticle, queue_id: queue.id, article_id: member.article_id)
end

assert Repo.aggregate(
         from(s in ArticleSnapshot,
           where: s.source_working_copy_id in ^Enum.map(members, & &1.working_copy_id)
         ),
         :count
       ) == 0

assert {:error, :conflict_release_rollback} =
         Repo.transaction(fn ->
           changed_member = hd(members)

           default =
             Repo.get_by!(ArticleWorkingCopy,
               article_id: changed_member.article_id,
               scope_kind: :default
             )

           assert {:ok, _} = Store.save_loaded(default, %{title: "D only"}, actor, 1, site.id)

           publications =
             for member <- members do
               copy = Repo.get!(ArticleWorkingCopy, member.working_copy_id)

               {:ok, snapshot} =
                 Snapshotter.freeze_in_transaction(
                   copy.id,
                   copy.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

               assert {:ok, _} =
                        SelectPublic.select(
                          site,
                          queue,
                          2,
                          member.article_id,
                          copy.revision,
                          snapshot.id,
                          nil,
                          actor,
                          DateTime.utc_now(:second)
                        )

               assert {:ok, _} =
                        AlignDefault.align(
                          site,
                          queue,
                          2,
                          member.article_id,
                          copy.revision,
                          snapshot.id,
                          actor
                        )

               lifecycle = Repo.get_by!(DocsLifecycle, article_id: member.article_id)

               {:ok, _} =
                 CMS.DocTree.Publish.Lifecycle.published(
                   lifecycle,
                   true,
                   DateTime.utc_now(:second)
                 )

               %{
                 article_id: member.article_id,
                 snapshot_id: snapshot.id,
                 work_revision: copy.revision
               }
             end

           assert Repo.get_by!(DocsPostPublishConflict,
                    community_id: site.id,
                    article_id: changed_member.article_id
                  )

           release = seal_release.(publications)
           assert {:ok, _} = Queue.consume_release(site, queue, 2, release.id, publications)
           refute Repo.get(ArticleWorkingCopy, changed_member.working_copy_id)
           published = Enum.find(publications, &(&1.article_id == changed_member.article_id))

           assert {:ok, %{working_copy: nil}} =
                    ResolveConflict.resolve(
                      site,
                      changed_member.article_id,
                      Repo.get_by!(ArticleWorkingCopy,
                        article_id: changed_member.article_id,
                        scope_kind: :default
                      ).id,
                      2,
                      published.snapshot_id,
                      %{title: :source},
                      actor
                    )

           refute Repo.get_by(DocsPostPublishConflict,
                    community_id: site.id,
                    article_id: changed_member.article_id
                  )

           Repo.rollback(:conflict_release_rollback)
         end)

assert {:ok, publications} =
         Repo.transact(fn ->
           publications =
             for member <- members do
               copy = Repo.get!(ArticleWorkingCopy, member.working_copy_id)

               {:ok, snapshot} =
                 Snapshotter.freeze_in_transaction(
                   copy.id,
                   copy.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

               assert {:ok, _} =
                        SelectPublic.select(
                          site,
                          queue,
                          2,
                          member.article_id,
                          copy.revision,
                          snapshot.id,
                          nil,
                          actor,
                          DateTime.utc_now(:second)
                        )

               assert {:ok, _} =
                        AlignDefault.align(
                          site,
                          queue,
                          2,
                          member.article_id,
                          copy.revision,
                          snapshot.id,
                          actor
                        )

               lifecycle = Repo.get_by!(DocsLifecycle, article_id: member.article_id)

               {:ok, _} =
                 CMS.DocTree.Publish.Lifecycle.published(
                   lifecycle,
                   true,
                   DateTime.utc_now(:second)
                 )

               %{
                 article_id: member.article_id,
                 snapshot_id: snapshot.id,
                 work_revision: copy.revision
               }
             end

           release = seal_release.(publications)

           assert {:ok, %{queue: %{queue_revision: 3}}} =
                    Queue.consume_release(site, queue, 2, release.id, publications)

           {:ok, publications}
         end)

for publication <- publications do
  assert Repo.get!(ArticlePublic, publication.article_id).snapshot_id == publication.snapshot_id
  assert Repo.get!(ArticleSnapshot, publication.snapshot_id)

  refute Repo.get_by(ArticleWorkingCopy,
           article_id: publication.article_id,
           scope_kind: :default
         )

  assert Repo.get_by!(DocsLifecycle, article_id: publication.article_id).default_working_copy_id ==
           nil

  refute Repo.get_by(DocsQueueArticle, queue_id: queue.id, article_id: publication.article_id)
end

for member <- members do
  assert Repo.get(ArticleWorkingCopy, member.working_copy_id) == nil
end

IO.puts("Docs Queue publication consumption passed")
