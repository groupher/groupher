defmodule GroupherServer.Test.CMS.Articles.Trash do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Activity, AlertWall, CMS}
  alias AlertWall.Model.{Item, UserReport}
  alias GroupherServer.CMS.Outbox.Event
  alias GroupherServer.PublicCache.Tags

  alias CMS.Model.{
    ArticleEmotionCount,
    Article,
    ArticleLifecycle,
    ArticleStats,
    Comment,
    TrashAction,
    TrashedArticle,
    TicketState
  }

  alias CMS.ArtimentMentions.MentionsGraph.Revision, as: Revision
  alias CMS.Model.Mentions.Endpoint, as: MentionEndpoint
  alias CMS.Model.Mentions.Edge
  alias Activity.Model.PostLog
  alias CMS.Tickets.Model.Source, as: TicketSource

  @site_host CMS.ArtimentMentions.Config.site_host()

  test "Trash hides, lists and restores one logical Article without deleting content" do
    {community, post, _attrs, user} = mock_article(:post)
    post_id = post.id

    assert {:ok, %TrashedArticle{} = item} = CMS.Articles.trash(post, user)
    assert Repo.get(CMS.Model.Article, post_id)
    assert CMS.Articles.Trash.trashed_article?(post)

    assert {:error, _} = read_article(community, :post, article_inner_id(post, community))

    assert {:ok, %{entries: []}} =
             CMS.Articles.page(
               :post,
               %{community: community.slug},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0}
             )

    assert {:ok, %{entries: [%TrashedArticle{hash_id: trash_ref}]}} =
             CMS.Articles.list_trashed(
               community,
               %{thread: :post},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
             )

    assert trash_ref == item.hash_id
    action = Repo.get!(TrashAction, item.trash_action_id)
    assert Repo.get_by(PostLog, action: :trashed, operation_ref: action.hash_id)

    assert {:ok, restored} = CMS.Articles.restore_trashed(item.hash_id, user)
    assert restored.id == post.id
    assert {:ok, _} = read_article(community, :post, article_inner_id(post, community))
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)
    refute Repo.get(TrashAction, item.trash_action_id)
  end

  test "trashing and restoring a Comment parent advances the global Mentions revision" do
    {community, post, _attrs, user} = mock_article(:post)

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(post, community),
               mock_comment(),
               user,
               Ecto.UUID.generate()
             )

    comment_endpoint = Repo.get_by!(MentionEndpoint, type: :comment, comment_id: comment.id)
    parent_endpoint = Repo.get!(MentionEndpoint, comment_endpoint.parent_endpoint_id)
    assert parent_endpoint.article_id == post.article_id

    {:ok, before_trash} = Revision.current()
    assert {:ok, trash_item} = CMS.Articles.trash(post, user)
    {:ok, after_trash} = Revision.current()
    assert after_trash > before_trash

    assert Repo.get!(MentionEndpoint, comment_endpoint.id).parent_endpoint_id ==
             parent_endpoint.id

    assert {:ok, _restored} = CMS.Articles.restore_trashed(trash_item.hash_id, user)
    {:ok, after_restore} = Revision.current()
    assert after_restore > after_trash

    assert Repo.get!(MentionEndpoint, comment_endpoint.id).parent_endpoint_id ==
             parent_endpoint.id
  end

  test "restore receipt replays after the Trash membership is gone" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)
    command_id = Ecto.UUID.generate()
    opts = [command_id: command_id, community_id: community.id, thread: :post]

    assert {:ok, first} = CMS.Articles.restore_trashed_receipt(item.hash_id, user, opts)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)
    assert {:ok, replayed} = CMS.Articles.restore_trashed_receipt(item.hash_id, user, opts)
    assert replayed == first
    assert replayed.command_id == command_id
  end

  test "restore scope validation is owned by the command use case" do
    {community, post, _attrs, user} = mock_article(:post)
    {:ok, other_community} = mock_community(user)
    assert {:ok, item} = CMS.Articles.trash(post, user)

    assert {:error, _reason} =
             CMS.Articles.restore_trashed(item.hash_id, user,
               command_id: Ecto.UUID.generate(),
               community_id: other_community.id,
               thread: :post
             )

    assert {:error, _reason} =
             CMS.Articles.restore_trashed(item.hash_id, user,
               command_id: Ecto.UUID.generate(),
               community_id: community.id,
               thread: :blog
             )

    assert Repo.get_by(TrashedArticle, hash_id: item.hash_id)
  end

  test "Trash excludes Articles from an author's published list and count" do
    {community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{entries: entries}} =
             CMS.Articles.paged_published(
               :post,
               %{},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20},
               user
             )

    assert Enum.any?(entries, &(&1.id == post.id))
    assert {:ok, count_before} = CMS.Articles.count_published(:post, user)

    assert {:ok, _item} = CMS.Articles.trash(post, user, community: community)

    assert {:ok, %{entries: entries}} =
             CMS.Articles.paged_published(
               :post,
               %{},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20},
               user
             )

    refute Enum.any?(entries, &(&1.id == post.id))
    assert {:ok, count_after} = CMS.Articles.count_published(:post, user)
    assert count_after == count_before - 1
  end

  test "permanent delete removes the aggregate but keeps append-only audit" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)

    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)
    refute Repo.get(CMS.Model.Article, post.article_id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)

    refute Repo.get_by(ArticleLifecycle,
             thread: :post,
             article_id: post.article_id
           )

    assert Repo.get_by(PostLog,
             action: :permanently_deleted,
             article_id: post.article_id
           )

    assert {:ok, %{entries: []}} =
             CMS.Articles.list_trashed(
               community,
               %{thread: :post},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
             )
  end

  test "Post permanent deletion unlinks its TicketSource and keeps the Ticket in Draft" do
    {community, post, _attrs, user} = mock_article(:post)
    passport = user.cur_passport || %{}
    community_passport = Map.get(passport, community.slug, %{})
    cms_grants = Map.get(community_passport, "cms", %{})

    ticket_actor = %{
      user
      | cur_passport:
          passport
          |> Map.put_new("global", %{})
          |> Map.put(
            community.slug,
            Map.put(
              community_passport,
              "cms",
              Map.merge(cms_grants, %{
                "ticket.create" => true,
                "ticket.read_internal" => true,
                "ticket.manage_visibility" => true
              })
            )
          )
    }

    assert {:ok, ticket} =
             CMS.Tickets.create_from_post(
               community,
               post.id,
               %{title: "Source post will be removed"},
               ticket_actor,
               Ecto.UUID.generate()
             )

    assert Repo.get_by!(TicketSource, ticket_id: ticket.id, post_id: post.id)

    assert {:ok, %TrashedArticle{} = trash_item} =
             CMS.Articles.trash(post, user, community: community)

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft

    assert {:ok, %{done: true}} =
             CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

    refute Repo.get(Article, post.id)
    refute Repo.get_by(TicketSource, ticket_id: ticket.id, post_id: post.id)
    assert Repo.get_by!(TicketState, article_id: ticket.id).type == :user
    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft
  end

  test "restoring a Ticket source Post purges both surfaces without republishing the Ticket" do
    {community, post, _attrs, user} = mock_article(:post)
    passport = user.cur_passport || %{}
    community_passport = Map.get(passport, community.slug, %{})
    cms_grants = Map.get(community_passport, "cms", %{})

    ticket_actor = %{
      user
      | cur_passport:
          passport
          |> Map.put_new("global", %{})
          |> Map.put(
            community.slug,
            Map.put(
              community_passport,
              "cms",
              Map.merge(cms_grants, %{
                "ticket.create" => true,
                "ticket.read_internal" => true,
                "ticket.manage_visibility" => true
              })
            )
          )
    }

    assert {:ok, ticket} =
             CMS.Tickets.create_from_post(
               community,
               post.id,
               %{title: "Ticket source restore"},
               ticket_actor,
               Ecto.UUID.generate()
             )

    assert {:ok, internal} = CMS.Tickets.get_internal(community, ticket.id, ticket_actor)

    assert {:ok, _ticket_id} =
             CMS.Tickets.publish(
               community,
               ticket.id,
               "Publish before testing source restore",
               internal.draft_version,
               internal.lifecycle_version,
               internal.workflow_version,
               ticket_actor,
               Ecto.UUID.generate(),
               CMS.Tickets.Publication.preview_anchor(community.id, ticket.id)
             )

    assert {:ok, ticket} = CMS.Tickets.get_internal(community, ticket.id, ticket_actor)
    assert is_integer(ticket.inner_id)

    assert {:ok, trash_item} = CMS.Articles.trash(post, user)
    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft

    events_before_restore =
      Repo.all(Event)
      |> Enum.count(fn event ->
        event.event == "ticket.cache_invalidation" and event.resource_id == ticket.id and
          Tags.ticket_detail(community.slug, ticket.inner_id) in event.data["cache_tags"] and
          Tags.article_detail(community.slug, :post, post.inner_id) in event.data["cache_tags"]
      end)

    assert {:ok, _restored_post} = CMS.Articles.restore_trashed(trash_item.hash_id, user)
    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft

    events_after_restore =
      Repo.all(Event)
      |> Enum.count(fn event ->
        event.event == "ticket.cache_invalidation" and event.resource_id == ticket.id and
          Tags.ticket_detail(community.slug, ticket.inner_id) in event.data["cache_tags"] and
          Tags.article_detail(community.slug, :post, post.inner_id) in event.data["cache_tags"]
      end)

    assert events_after_restore > events_before_restore
  end

  test "permanent delete supersedes Wall items and preserves report history" do
    {_community, post, _attrs, user} = mock_article(:post)

    report_attrs = %{
      reporter_id: user.id,
      owner: :cms,
      target_type: :article,
      target_id: to_string(post.article_id),
      observed_version: 1,
      community_id: nil,
      report_type: "SPAM",
      details: "Please review"
    }

    assert {:ok, {item, report}} =
             Repo.transact_result(fn ->
               with {:ok, report} <-
                      AlertWall.submit_report_in_transaction(
                        report_attrs,
                        Ecto.UUID.generate()
                      ),
                    %Item{} = item <- Repo.get(Item, report.item_id) do
                 {:ok, {item, report}}
               else
                 {:error, reason} -> {:error, reason}
                 _ -> {:error, :wall_item_not_found}
               end
             end)

    assert {:ok, trash_item} = CMS.Articles.trash(post, user)

    assert {:ok, %{done: true}} =
             CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

    deleted_item = Repo.get!(Item, item.id)
    assert deleted_item.target_id == to_string(post.article_id)
    assert deleted_item.target_deleted_at
    assert deleted_item.status == :superseded

    deleted_report = Repo.get!(UserReport, report.id)
    assert deleted_report.target_id == to_string(post.article_id)
    assert deleted_report.item_id == item.id
    assert deleted_report.outdated_at
  end

  test "permanent-delete receipt replays after the aggregate is gone" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)
    command_id = Ecto.UUID.generate()
    opts = [command_id: command_id, community_id: community.id, thread: :post]

    assert {:ok, %{done: true, command_id: ^command_id} = first} =
             CMS.Articles.permanently_delete_trashed_receipt(item.hash_id, user, opts)

    refute Repo.get(CMS.Model.Article, post.article_id)

    assert {:ok, replayed} =
             CMS.Articles.permanently_delete_trashed_receipt(item.hash_id, user, opts)

    assert replayed == first
  end

  test "permanent delete rejects a stale emotion request and leaves no orphan projections" do
    {_community, post, _attrs, user} = mock_article(:post)
    {:ok, other_user} = db_insert(:user)

    assert {:ok, _} = CMS.Interactions.emotion(post, :heart, other_user, Ecto.UUID.generate())
    assert {:ok, item} = CMS.Articles.trash(post, user)

    assert {:error, _reason} =
             CMS.Interactions.emotion(post, :beer, other_user, Ecto.UUID.generate())

    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)

    refute Repo.get(CMS.Model.Article, post.article_id)
    refute Repo.get_by(ArticleStats, thread: :post, article_id: post.article_id)
    refute Repo.get_by(ArticleEmotionCount, thread: :post, article_id: post.article_id)
  end

  test "permanent parent delete preserves Comment identity without claiming it was deleted" do
    {community, post, _attrs, user} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, user)

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "comment-mention",
          "children" => [
            %{
              "type" => "a",
              "url" =>
                "#{@site_host}/#{community.slug}/blog/#{article_inner_id(target, community)}",
              "children" => [%{"text" => "target link text"}]
            }
          ]
        }
      ])

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(post, community),
               mock_body_bag(body),
               user,
               Ecto.UUID.generate()
             )

    comment_endpoint = Repo.get_by!(MentionEndpoint, type: :comment, comment_id: comment.id)
    edge = Repo.get_by!(Edge, source_endpoint_id: comment_endpoint.id)
    assert edge.target_endpoint_id

    assert {:ok, item} = CMS.Articles.trash(post, user)
    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)

    refute Repo.get(Comment, comment.id)
    assert is_nil(Repo.get!(MentionEndpoint, comment_endpoint.id).deleted_at)
    refute Repo.get(Edge, edge.id)
    assert Repo.aggregate(Edge, :count) == 0
  end

  test "incoming Mention edge survives Trash and restore but clears on permanent deletion" do
    {community, target, _attrs, user} = mock_article(:post)
    {_, mentioner, _, _} = mock_article(:blog, community, user)

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "mention-target",
          "children" => [
            %{
              "type" => "mention",
              "key" => "post:#{target.article_id}",
              "value" => "target mention",
              "children" => [%{"text" => ""}]
            }
          ]
        }
      ])

    assert {:ok, mentioner} =
             CMS.Articles.update(
               mentioner,
               %{
                 body_bag: mock_body_bag(body),
                 expected_version: mentioner.version
               },
               user,
               Ecto.UUID.generate()
             )

    source_endpoint =
      Repo.get_by!(MentionEndpoint, type: :blog, article_id: mentioner.article_id)

    target_endpoint = Repo.get_by!(MentionEndpoint, type: :post, article_id: target.article_id)

    edge =
      Repo.get_by!(Edge,
        source_endpoint_id: source_endpoint.id,
        target_endpoint_id: target_endpoint.id
      )

    assert {:ok, item} = CMS.Articles.trash(target, user)
    assert Repo.get!(Edge, edge.id).target_endpoint_id == target_endpoint.id

    edited_body = String.replace(body, "target mention", "target again")

    assert {:ok, _edited_mentioner} =
             CMS.Articles.update(
               mentioner,
               %{
                 body_bag: mock_body_bag(edited_body),
                 expected_version: mentioner.version
               },
               user,
               Ecto.UUID.generate()
             )

    projected_edge =
      Repo.get_by!(Edge,
        source_endpoint_id: source_endpoint.id,
        target_endpoint_id: target_endpoint.id
      )

    assert projected_edge.id == edge.id
    assert projected_edge.mentioned_at == edge.mentioned_at

    assert {:ok, %{entries: [_listed]}} =
             CMS.Articles.list_trashed(
               community,
               %{thread: :post},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
             )

    assert {:ok, _} = CMS.Articles.restore_trashed(item.hash_id, user)
    assert Repo.get!(Edge, projected_edge.id).target_endpoint_id == target_endpoint.id

    assert {:ok, item} = CMS.Articles.trash(target, user)
    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)

    assert Repo.get!(MentionEndpoint, target_endpoint.id).deleted_at
    refute Repo.get(Edge, projected_edge.id)
  end

  test "scheduler permanently deletes due actions and records a system audit" do
    {_community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user, retention_days: 0)

    assert {:ok, %{deleted: 1, failed: []}} =
             CMS.Trash.purge_due(now: DateTime.utc_now(:second), size: 10)

    refute Repo.get(CMS.Model.Article, post.article_id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)

    assert Repo.get_by(PostLog,
             action: :permanently_deleted,
             article_id: post.article_id,
             source: :scheduler
           )
  end

  test "scoped Trash permanent delete uses the Article receipt command" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)
    action = Repo.get!(TrashAction, item.trash_action_id)
    command_id = Ecto.UUID.generate()

    assert {:ok, %{done: true, command_id: ^command_id}} =
             CMS.Trash.permanently_delete_action_in_scope(
               action.hash_id,
               community.id,
               :post,
               user,
               command_id: command_id
             )

    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)
    refute Repo.get(TrashAction, item.trash_action_id)
  end

  test "standalone Doc Trash is rejected so Tree placement cannot become dangling" do
    {_community, doc, _attrs, user} = mock_article(:doc)

    assert {:error, %ErrorCat.Error{reason: :custom, details: message}} =
             CMS.Articles.trash(doc, user)

    assert message =~ "Docs Tree lifecycle"
  end

  test "Trash and restore update community counters for ordinary Article threads" do
    Enum.each([:post, :blog, :changelog], fn thread ->
      {community, article, _attrs, user} = mock_article(thread)
      count_field = String.to_existing_atom("#{thread}s_count")

      assert Repo.get!(CMS.Model.Community, community.id).meta |> Map.fetch!(count_field) == 1

      assert {:ok, item} = CMS.Articles.trash(article, user)
      assert Repo.get!(CMS.Model.Community, community.id).meta |> Map.fetch!(count_field) == 0

      assert {:ok, _} = CMS.Articles.restore_trashed(item.hash_id, user)
      assert Repo.get!(CMS.Model.Community, community.id).meta |> Map.fetch!(count_field) == 1
    end)
  end
end
