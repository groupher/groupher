defmodule GroupherServer.Test.CMS.Articles.ArticleHistoryQueryTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  import GroupherServer.Support.Factory

  alias GroupherServer.CMS
  alias CMS.Articles.WorkingCopy.{Diff, History, Snapshotter}
  alias CMS.Model.{ArticleEvent, ArticlePublic, ArticleSnapshot, ArticleWorkingCopy}

  test "history pages and event Diff use immutable sequence and same-Article refs" do
    {community, post, _, actor} = mock_article(:post)
    {_, other_post, _, _} = mock_article(:post)
    article = Repo.get!(CMS.Model.Article, post.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "History query changed title"},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert saved.revision == work.revision + 1

    current_public = Repo.get!(CMS.Model.ArticlePublic, article.id)

    assert {:ok, _published} =
             CMS.Articles.publish_article(
               article,
               community,
               %{working_copy_id: work.id, revision: saved.revision},
               current_public.snapshot_id,
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, %{items: [first], next_cursor: cursor}} =
             CMS.Articles.history_events(article.id, actor, limit: 1)

    assert is_integer(cursor)

    assert {:ok, %{items: next_items}} =
             CMS.Articles.history_events(article.id, actor, limit: 1, cursor: cursor)

    assert next_items != []
    refute first.sequence in Enum.map(next_items, & &1.sequence)

    assert {:ok, %{items: actor_events}} =
             CMS.Articles.history_events(article.id, actor, actor_id: actor.id)

    assert actor_events != []
    assert Enum.all?(actor_events, &(&1.actor_id == actor.id))

    edit =
      Repo.one!(
        from(event in ArticleEvent,
          where: event.article_id == ^article.id and event.type == :edit
        )
      )

    assert {:ok, detail} = CMS.Articles.history_event(article.id, edit.id, actor)
    assert detail.diff.fields.title.after == "History query changed title"
    assert detail.diff.fields.title.before != detail.diff.fields.title.after

    publish_event =
      Repo.one!(
        from(event in ArticleEvent,
          where: event.article_id == ^article.id and event.type == :publish,
          order_by: [desc: event.sequence],
          limit: 1
        )
      )

    assert {:ok, publish_detail} = CMS.Articles.history_event(article.id, publish_event.id, actor)
    assert publish_detail.contributors.unknown == false
    assert [%{actor_id: actor_id, event_ids: [edit_id]}] = publish_detail.contributors.items
    assert actor_id == actor.id
    assert edit_id == edit.id

    before = %{type: :snapshot, snapshot_id: edit.before_snapshot_id}
    after_snapshot = %{type: :snapshot, snapshot_id: edit.after_snapshot_id}

    assert {:ok, snapshot_diff} =
             CMS.Articles.history_diff(article.id, before, after_snapshot, actor)

    assert {:ok, repeated_diff} =
             CMS.Articles.history_diff(article.id, before, after_snapshot, actor)

    assert snapshot_diff == repeated_diff
    assert snapshot_diff.fields.title.after == "History query changed title"

    assert {:ok, working_copy_diff} =
             CMS.Articles.history_diff(
               article.id,
               before,
               %{type: :working_copy, working_copy_id: work.id, revision: saved.revision},
               actor
             )

    assert working_copy_diff.fields.title.after == "History query changed title"

    assert {:error, :article_working_copy_revision_conflict} =
             CMS.Articles.history_diff(
               article.id,
               before,
               %{type: :working_copy, working_copy_id: work.id, revision: work.revision},
               actor
             )

    other_snapshot =
      Repo.one!(from(snapshot in ArticleSnapshot, where: snapshot.article_id == ^other_post.id))

    assert {:error, :article_history_unavailable} =
             CMS.Articles.history_diff(
               article.id,
               %{type: :snapshot, snapshot_id: other_snapshot.id},
               after_snapshot,
               actor
             )

    assert {:error, :article_history_unavailable} =
             CMS.Articles.history_diff(
               article.id,
               Map.put(before, :revision, 1),
               after_snapshot,
               actor
             )

    query = """
    query ArticleEvents($articleId: ID!, $eventId: ID!, $pagi: Json, $actorId: ID) {
      pagedArticleEvents(articleId: $articleId, pagi: $pagi, actorId: $actorId)
      articleEvent(articleId: $articleId, eventId: $eventId)
    }
    """

    assert {:ok, %{data: %{"pagedArticleEvents" => %{items: [_ | _]}, "articleEvent" => %{}}}} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: %{
                 "articleId" => article.id,
                 "eventId" => edit.id,
                 "pagi" => Jason.encode!(%{limit: 20, cursor: nil}),
                 "actorId" => actor.id
               },
               context: %{cur_user: actor}
             )

    diff_query = """
    query ArticleDiff(
      $articleId: ID!
      $before: ArticleVersionRefInput!
      $after: ArticleVersionRefInput!
    ) {
      articleDiff(articleId: $articleId, before: $before, after: $after)
    }
    """

    assert {:ok, %{data: %{"articleDiff" => %{fields: fields}}}} =
             Absinthe.run(diff_query, GroupherServerWeb.Schema,
               variables: %{
                 "articleId" => article.id,
                 "before" => %{
                   "type" => "SNAPSHOT",
                   "snapshotId" => edit.before_snapshot_id
                 },
                 "after" => %{
                   "type" => "SNAPSHOT",
                   "snapshotId" => edit.after_snapshot_id
                 }
               },
               context: %{cur_user: actor}
             )

    assert fields.title.after == "History query changed title"
  end

  test "history requires article.history.read even when the caller can read the public Article" do
    {_, post, _, _owner} = mock_article(:post)
    {:ok, reader} = db_insert(:user)

    assert {:error, :article_history_unavailable} =
             CMS.Articles.history_events(post.id, reader)
  end

  test "publish contributors follow previous events across no-op revisions" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "Contributor baseline", body_bag: mock_body_bag(mock_rich_text("base"))},
               actor,
               command_id: Ecto.UUID.generate()
             )

    create_event = Repo.get_by!(ArticleEvent, article_id: article.id, type: :create)

    assert {:ok, no_op} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: work.title},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert no_op.revision == work.revision + 1

    refute Repo.exists?(
             from(event in ArticleEvent,
               where: event.article_id == ^article.id and event.after_revision == ^no_op.revision
             )
           )

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Contributor after no-op"},
               no_op.revision,
               actor,
               Ecto.UUID.generate()
             )

    edit_event =
      Repo.get_by!(ArticleEvent,
        article_id: article.id,
        type: :edit,
        after_revision: saved.revision
      )

    assert edit_event.previous_event_id == create_event.id

    assert {:ok, _} =
             CMS.Articles.publish_article(
               article,
               community,
               %{working_copy_id: work.id, revision: saved.revision},
               nil,
               actor,
               Ecto.UUID.generate()
             )

    publish_event =
      Repo.one!(
        from(event in ArticleEvent,
          where: event.article_id == ^article.id and event.type == :publish
        )
      )

    assert {:ok, detail} = CMS.Articles.history_event(article.id, publish_event.id, actor)
    assert detail.contributors.unknown == false
    contributor_event_ids = Enum.flat_map(detail.contributors.items, & &1.event_ids)
    assert create_event.id in contributor_event_ids
    assert edit_event.id in contributor_event_ids
  end

  test "publish contributors include source authors but exclude pure fork actors" do
    {community, public, _, actor} = mock_article(:post)
    article = Repo.get!(CMS.Model.Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    before_public = Repo.get!(ArticlePublic, article.id).snapshot_id

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Source contribution"},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    source_event =
      Repo.get_by!(ArticleEvent,
        article_id: article.id,
        type: :edit,
        after_revision: saved.revision
      )

    assert {:ok, %{working_copy: fork}} =
             CMS.Articles.fork_snapshot(
               source_event.after_snapshot_id,
               community,
               :workspace,
               Ecto.UUID.generate(),
               actor,
               Ecto.UUID.generate()
             )

    fork_event = Repo.get_by!(ArticleEvent, working_copy_id: fork.id, type: :fork)

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :last_publish_time,
      actor,
      minutes: -CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes
    )

    assert {:ok, _} =
             CMS.Articles.publish_article(
               article,
               community,
               %{working_copy_id: fork.id, revision: fork.revision},
               before_public,
               actor,
               Ecto.UUID.generate()
             )

    publish_event =
      Repo.one!(
        from(event in ArticleEvent,
          where: event.article_id == ^article.id and event.type == :publish,
          order_by: [desc: event.sequence],
          limit: 1
        )
      )

    assert {:ok, detail} = CMS.Articles.history_event(article.id, publish_event.id, actor)
    assert detail.contributors.unknown == false
    contributor_event_ids = Enum.flat_map(detail.contributors.items, & &1.event_ids)
    assert source_event.id in contributor_event_ids
    refute fork_event.id in contributor_event_ids
  end

  test "publish contributors mark an unlinked cross-Article fork as unknown" do
    {community, public, _, actor} = mock_article(:post)
    article = Repo.get!(CMS.Model.Article, public.article_id)
    source_snapshot_id = Repo.get!(ArticlePublic, article.id).snapshot_id
    command_id = Ecto.UUID.generate()

    assert {:ok, %{working_copy: fork, event: fork_event}} =
             Repo.transaction(fn ->
               assert {:ok, work} =
                        Snapshotter.fork_snapshot_in_transaction(
                          source_snapshot_id,
                          %{
                            article_id: article.id,
                            scope_type: :workspace,
                            scope_id: Ecto.UUID.generate()
                          },
                          actor
                        )

               attrs =
                 History.event_attrs(
                   actor,
                   command_id,
                   community.id,
                   %{source: :browser, service_ref: nil},
                   0
                 )
                 |> Map.put(:type, :fork)

               assert {:ok, event} =
                        History.record_initial_in_transaction(
                          article,
                          work,
                          actor,
                          command_id,
                          attrs
                        )

               %{working_copy: work, event: event}
             end)

    assert {:ok, _} =
             CMS.Articles.publish_article(
               article,
               community,
               %{working_copy_id: fork.id, revision: fork.revision},
               source_snapshot_id,
               actor,
               Ecto.UUID.generate()
             )

    publish_event =
      Repo.one!(
        from(event in ArticleEvent,
          where: event.article_id == ^article.id and event.type == :publish,
          order_by: [desc: event.sequence],
          limit: 1
        )
      )

    assert {:ok, detail} = CMS.Articles.history_event(article.id, publish_event.id, actor)
    assert detail.contributors.unknown
    refute fork_event.id in Enum.flat_map(detail.contributors.items, & &1.event_ids)
  end

  test "Diff keeps block additions, removals, edits, moves, empty bodies and repeatability" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)

    before_body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "block-1",
          "_id" => "block-1",
          "children" => [%{"text" => "one"}]
        },
        %{
          "type" => "p",
          "id" => "block-2",
          "_id" => "block-2",
          "children" => [%{"text" => "two"}]
        },
        %{
          "type" => "p",
          "id" => "block-3",
          "_id" => "block-3",
          "children" => [%{"text" => "three"}]
        }
      ])

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "Diff edge cases", body_bag: mock_body_bag(before_body)},
               actor,
               command_id: Ecto.UUID.generate()
             )

    before_snapshot_id =
      Repo.get_by!(ArticleEvent, article_id: article.id, type: :create).after_snapshot_id

    after_body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "block-3",
          "_id" => "block-3",
          "children" => [%{"text" => "three"}]
        },
        %{
          "type" => "p",
          "id" => "block-1",
          "_id" => "block-1",
          "children" => [%{"text" => "one edited"}]
        },
        %{
          "type" => "p",
          "id" => "block-4",
          "_id" => "block-4",
          "children" => [%{"text" => "four"}]
        }
      ])

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{body_bag: mock_body_bag(after_body)},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    after_snapshot_id =
      Repo.get_by!(ArticleEvent,
        article_id: article.id,
        type: :edit,
        after_revision: saved.revision
      ).after_snapshot_id

    assert {:ok, first_diff} = Diff.compare(before_snapshot_id, after_snapshot_id)
    assert {:ok, repeated_diff} = Diff.compare(before_snapshot_id, after_snapshot_id)
    assert first_diff == repeated_diff
    assert Enum.map(first_diff.body.added, & &1.id) == ["block-4"]
    assert Enum.map(first_diff.body.removed, & &1.id) == ["block-2"]
    assert Enum.map(first_diff.body.changed, & &1.id) == ["block-1"]
    assert Enum.map(first_diff.body.moved, & &1.id) == ["block-1", "block-3"]

    assert {:ok, empty_saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{body_bag: mock_body_bag(Jason.encode!([]))},
               saved.revision,
               actor,
               Ecto.UUID.generate()
             )

    empty_snapshot_id =
      Repo.get_by!(ArticleEvent,
        article_id: article.id,
        type: :edit,
        after_revision: empty_saved.revision
      ).after_snapshot_id

    assert {:ok, empty_diff} = Diff.compare(after_snapshot_id, empty_snapshot_id)
    assert Enum.map(empty_diff.body.removed, & &1.id) == ["block-1", "block-3", "block-4"]
    assert {:ok, same_empty_diff} = Diff.compare(empty_snapshot_id, empty_snapshot_id)
    assert same_empty_diff.body.equal
    assert same_empty_diff.body.added == []
    assert same_empty_diff.body.removed == []
  end
end
