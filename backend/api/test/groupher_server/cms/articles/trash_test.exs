defmodule GroupherServer.Test.CMS.Articles.Trash do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Accounts, Activity, AlertWall, CMS, PublicCache}
  alias AlertWall.Model.{Action, Item, UserReport}
  alias CMS.Outbox.Event
  alias PublicCache.Tags

  alias CMS.Model.{
    ArticleEmotionCount,
    Article,
    ArticleLifecycle,
    ArticleStats,
    ArticlePublic,
    ArticleWorkingCopy,
    CommunityAdmin,
    Comment,
    TrashAction,
    TrashedArticle,
    TicketState
  }

  alias Accounts.Model.{CollectFolder, CollectFolderEntry}

  alias CMS.ArtimentMentions.MentionsGraph.Revision, as: Revision
  alias CMS.Model.Mentions.Endpoint
  alias CMS.Model.Mentions.Edge
  alias Activity.Model.PostLog
  alias CMS.Tickets.Model.Source

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
    log = Repo.get_by!(PostLog, action: :trashed, article_id: post.id)
    refute log.operation_ref == action.hash_id
    assert {:ok, _operation_ref} = Ecto.UUID.cast(log.operation_ref)

    assert {:ok, restored} = CMS.Articles.restore_trashed(item.hash_id, user)
    assert restored.id == post.id
    assert {:ok, _} = read_article(community, :post, article_inner_id(post, community))
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)
    refute Repo.get(TrashAction, item.trash_action_id)
  end

  test "Trash aggregate requires a valid operation_ref and never falls back to resource identity" do
    {community, post, _attrs, user} = mock_article(:post)

    assert {:error, :operation_ref_required} =
             CMS.Articles.Trash.trash(post, user, community: community)

    assert {:error, _reason} =
             CMS.Articles.Trash.trash(post, user,
               community: community,
               operation_ref: "not-a-uuid"
             )

    refute CMS.Articles.Trash.trashed_article?(post)
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

    comment_endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)
    parent_endpoint = Repo.get!(Endpoint, comment_endpoint.parent_endpoint_id)
    assert parent_endpoint.article_id == post.id

    {:ok, before_trash} = Revision.current()
    assert {:ok, trash_item} = CMS.Articles.trash(post, user)
    {:ok, after_trash} = Revision.current()
    assert after_trash > before_trash

    assert Repo.get!(Endpoint, comment_endpoint.id).parent_endpoint_id ==
             parent_endpoint.id

    assert {:ok, _restored} = CMS.Articles.restore_trashed(trash_item.hash_id, user)
    {:ok, after_restore} = Revision.current()
    assert after_restore > after_trash

    assert Repo.get!(Endpoint, comment_endpoint.id).parent_endpoint_id ==
             parent_endpoint.id
  end

  test "restore receipt replays after the Trash membership is gone" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)
    command_id = Ecto.UUID.generate()
    opts = [command_id: command_id, community_id: community.id, thread: :post]

    assert {:ok, first} = CMS.Articles.restore_trashed_receipt(item.hash_id, user, opts)
    receipt = Repo.get_by!(CMS.Model.CommandReceipt, command_id: command_id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)
    assert {:ok, replayed} = CMS.Articles.restore_trashed_receipt(item.hash_id, user, opts)
    replayed_receipt = Repo.get_by!(CMS.Model.CommandReceipt, command_id: command_id)
    assert replayed == first
    assert replayed.command_id == command_id
    assert replayed_receipt.operation_ref == receipt.operation_ref
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

  test "permanent delete purges an unprotected Article and its retained history" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)

    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)
    refute Repo.get(CMS.Model.Article, post.id)
    refute Repo.get_by(CMS.Model.ArticleHistoryOwner, article_id: post.id)

    refute Repo.exists?(from(s in CMS.Model.ArticleSnapshot, where: s.article_id == ^post.id))

    refute Repo.get(CMS.Model.ArticlePublic, post.id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)

    refute Repo.get_by(ArticleLifecycle,
             thread: :post,
             article_id: post.id
           )

    assert Repo.get_by(PostLog,
             action: :permanently_deleted,
             article_id: post.id
           )

    assert {:ok, %{entries: []}} =
             CMS.Articles.list_trashed(
               community,
               %{thread: :post},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
             )
  end

  test "permanent Article deletion maintains collected-folder counters" do
    {_community, post, _attrs, user} = mock_article(:post)
    {:ok, folder} = Accounts.CollectFolders.create(%{title: "Reading list"}, user)
    {:ok, collected_folder} = Accounts.CollectFolders.add(post, folder.id, user)

    assert collected_folder.total_count == 1
    assert collected_folder.meta.post_count == 1

    assert {:ok, trash_item} = CMS.Articles.trash(post, user)
    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

    deleted_folder = Repo.get!(CollectFolder, folder.id)
    assert deleted_folder.total_count == 0
    assert deleted_folder.meta.post_count == 0
    refute deleted_folder.meta.has_post
    refute Repo.get_by(CollectFolderEntry, folder_id: folder.id, article_id: post.id)
  end

  test "Post permanent deletion unlinks its TicketSource and keeps the Ticket in Draft" do
    {community, post, _attrs, user} = mock_article(:post)
    ticket_actor = grant_ticket_actions(community, user)

    assert {:ok, ticket} =
             CMS.Tickets.create_from_post(
               community,
               post.id,
               %{title: "Source post will be removed"},
               ticket_actor,
               Ecto.UUID.generate()
             )

    assert Repo.get_by!(Source, ticket_id: ticket.id, post_id: post.id)

    assert {:ok, %TrashedArticle{} = trash_item} =
             CMS.Articles.trash(post, user, community: community)

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft

    assert {:ok, %{done: true}} =
             CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

    refute Repo.get(Article, post.id)
    refute Repo.get_by(Source, ticket_id: ticket.id, post_id: post.id)
    assert Repo.get_by!(TicketState, article_id: ticket.id).type == :user
    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft
  end

  test "restoring a Ticket source Post purges both surfaces without republishing the Ticket" do
    {community, post, _attrs, user} = mock_article(:post)
    ticket_actor = grant_ticket_actions(community, user)

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
               internal.working_copy_revision,
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

    restore_event_matches? = fn event ->
      event.event == "ticket.cache_invalidation" and event.resource_id == ticket.id and
        Tags.ticket_detail(community.slug, ticket.inner_id) in event.data["cache_tags"] and
        Tags.article_detail(community.slug, :post, post.inner_id) in event.data["cache_tags"]
    end

    events_before_restore = Repo.all(Event) |> Enum.filter(restore_event_matches?)
    event_ids_before_restore = MapSet.new(events_before_restore, & &1.id)
    trash_action = Repo.get!(TrashAction, trash_item.trash_action_id)
    client_command_id = Ecto.UUID.generate()

    assert {:ok, _restored_post} =
             CMS.Articles.restore_trashed(trash_item.hash_id, user, command_id: client_command_id)

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft

    events_after_restore =
      Repo.all(Event)
      |> Enum.filter(restore_event_matches?)

    assert length(events_after_restore) > length(events_before_restore)

    restore_event =
      Enum.find(events_after_restore, &(not MapSet.member?(event_ids_before_restore, &1.id)))

    assert restore_event
    refute restore_event.operation_ref == trash_action.hash_id
    refute restore_event.operation_ref == client_command_id
    assert {:ok, _operation_ref} = Ecto.UUID.cast(restore_event.operation_ref)
  end

  test "permanent delete supersedes Wall items and preserves report history" do
    {_community, post, _attrs, user} = mock_article(:post)

    report_attrs = %{
      reporter_id: user.id,
      owner: :cms,
      target_type: :article,
      target_id: to_string(post.id),
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
    assert deleted_item.target_id == to_string(post.id)
    assert deleted_item.target_deleted_at
    assert deleted_item.status == :superseded

    deleted_report = Repo.get!(UserReport, report.id)
    assert deleted_report.target_id == to_string(post.id)
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

    refute Repo.get(CMS.Model.Article, post.id)

    assert {:ok, replayed} =
             CMS.Articles.permanently_delete_trashed_receipt(item.hash_id, user, opts)

    assert replayed == first
  end

  test "permanent-delete receipt activity uses the command operation_ref" do
    {community, post, _attrs, user} = mock_article(:post)
    comment = create_trash_comment(community, post, user)
    article_report = create_wall_report(:article, post.id, user)
    comment_report = create_wall_report(:comment, comment.id, user)
    assert {:ok, item} = CMS.Articles.trash(post, user)
    action = Repo.get!(TrashAction, item.trash_action_id)
    command_id = Ecto.UUID.generate()
    opts = [command_id: command_id, community_id: community.id, thread: :post]

    assert {:ok, %{done: true}} =
             CMS.Articles.permanently_delete_trashed_receipt(item.hash_id, user, opts)

    receipt = Repo.get_by!(CMS.Model.CommandReceipt, command_id: command_id)
    log = Repo.get_by!(PostLog, action: :permanently_deleted, article_id: post.id)
    assert log.operation_ref == receipt.operation_ref
    refute log.operation_ref == action.hash_id

    assert_wall_delete_actions(
      [article_report.item_id, comment_report.item_id],
      receipt.operation_ref
    )

    assert {:ok, replayed} =
             CMS.Articles.permanently_delete_trashed_receipt(item.hash_id, user, opts)

    assert replayed.done

    assert Repo.get_by!(CMS.Model.CommandReceipt, command_id: command_id).operation_ref ==
             receipt.operation_ref

    assert Repo.get_by!(PostLog, action: :permanently_deleted, article_id: post.id) == log

    assert_wall_delete_actions(
      [article_report.item_id, comment_report.item_id],
      receipt.operation_ref
    )
  end

  test "direct permanent-delete activity uses the runner operation_ref" do
    {community, post, _attrs, user} = mock_article(:post)
    comment = create_trash_comment(community, post, user)
    article_report = create_wall_report(:article, post.id, user)
    comment_report = create_wall_report(:comment, comment.id, user)
    assert {:ok, item} = CMS.Articles.trash(post, user)
    action = Repo.get!(TrashAction, item.trash_action_id)
    client_command_id = Ecto.UUID.generate()

    assert {:ok, %{done: true}} =
             CMS.Articles.permanently_delete_trashed(item.hash_id, user,
               command_id: client_command_id
             )

    log = Repo.get_by!(PostLog, action: :permanently_deleted, article_id: post.id)
    assert {:ok, _operation_ref} = Ecto.UUID.cast(log.operation_ref)
    refute log.operation_ref == action.hash_id
    refute log.operation_ref == client_command_id

    assert_wall_delete_actions(
      [article_report.item_id, comment_report.item_id],
      log.operation_ref
    )
  end

  test "permanent delete rejects a stale emotion request and leaves no orphan projections" do
    {_community, post, _attrs, user} = mock_article(:post)
    {:ok, other_user} = db_insert(:user)

    assert {:ok, _} = CMS.Interactions.emotion(post, :heart, other_user, Ecto.UUID.generate())
    assert {:ok, item} = CMS.Articles.trash(post, user)

    assert {:error, _reason} =
             CMS.Interactions.emotion(post, :beer, other_user, Ecto.UUID.generate())

    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)

    refute Repo.get(CMS.Model.Article, post.id)
    refute Repo.get_by(ArticleStats, thread: :post, article_id: post.id)
    refute Repo.get_by(ArticleEmotionCount, thread: :post, article_id: post.id)
  end

  test "permanent parent delete removes Comment identity and clears projections" do
    {community, post, _attrs, user} = mock_article(:post)
    reset_publish_throttle(user)
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

    comment_endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)
    edge = Repo.get_by!(Edge, source_endpoint_id: comment_endpoint.id)
    assert edge.target_endpoint_id

    assert {:ok, item} = CMS.Articles.trash(post, user)
    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)

    refute Repo.get(Comment, comment.id)
    assert is_nil(Repo.get!(Endpoint, comment_endpoint.id).deleted_at)
    refute Repo.get(Edge, edge.id)
    assert Repo.aggregate(Edge, :count) == 0
  end

  test "incoming Mention edge survives Trash and restore but clears on permanent deletion" do
    {community, target, _attrs, user} = mock_article(:post)
    reset_publish_throttle(user)
    {_, mentioner, _, _} = mock_article(:blog, community, user)

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "mention-target",
          "children" => [
            %{"text" => "See "},
            %{
              "type" => "mention",
              "key" => "post:#{target.id}",
              "value" => "target mention",
              "children" => [%{"text" => ""}]
            }
          ]
        }
      ])

    assert {:ok, %{article_id: mentioner_article_id}} =
             save_and_publish_mentioner(mentioner, community, user, body)

    source_endpoint =
      Repo.get_by!(Endpoint, type: :blog, article_id: mentioner_article_id)

    target_endpoint = Repo.get_by!(Endpoint, type: :post, article_id: target.id)

    edge =
      Repo.get_by!(Edge,
        source_endpoint_id: source_endpoint.id,
        target_endpoint_id: target_endpoint.id
      )

    assert {:ok, item} = CMS.Articles.trash(target, user)
    assert Repo.get!(Edge, edge.id).target_endpoint_id == target_endpoint.id

    edited_body = String.replace(body, "target mention", "target again")

    assert {:ok, _edited_mentioner} =
             save_and_publish_mentioner(mentioner, community, user, edited_body)

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

    assert Repo.get!(Endpoint, target_endpoint.id).deleted_at
    refute Repo.get(Edge, projected_edge.id)
  end

  test "scheduler permanently deletes due actions and records a system audit" do
    {_community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user, retention_days: 0)
    action = Repo.get!(TrashAction, item.trash_action_id)

    assert {:ok, %{deleted: 1, failed: []}} =
             CMS.Trash.purge_due(now: DateTime.utc_now(:second), size: 10)

    refute Repo.get(CMS.Model.Article, post.id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)

    log =
      Repo.get_by!(PostLog,
        action: :permanently_deleted,
        article_id: post.id,
        source: :scheduler
      )

    refute log.operation_ref == action.hash_id
    assert {:ok, _operation_ref} = Ecto.UUID.cast(log.operation_ref)
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

  defp grant_ticket_actions(community, user) do
    permissions =
      ~w(ticket.create ticket.link_source ticket.update ticket.transition ticket.assign ticket.manage_case ticket.manage_visibility ticket.read_internal)
      |> Map.new(&{&1, true})

    case Repo.get_by(CommunityAdmin, user_id: user.id, community_id: community.id) do
      %CommunityAdmin{} = member ->
        member
        |> CommunityAdmin.changeset(%{
          permissions: Map.merge(member.permissions, permissions)
        })
        |> Repo.update!()

      nil ->
        %CommunityAdmin{}
        |> CommunityAdmin.changeset(%{
          user_id: user.id,
          community_id: community.id,
          permissions: permissions
        })
        |> Repo.insert!()
    end

    user
  end

  defp create_trash_comment(community, post, user) do
    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(post, community),
               mock_comment(
                 "A sufficiently detailed comment body for the permanent deletion test."
               ),
               user,
               Ecto.UUID.generate()
             )

    comment
  end

  defp reset_publish_throttle(user) do
    assert {:ok, _throttle} =
             CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
               :last_publish_time,
               user,
               minutes: -CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes
             )
  end

  defp create_wall_report(target_type, target_id, user) do
    attrs = %{
      reporter_id: user.id,
      owner: :cms,
      target_type: target_type,
      target_id: to_string(target_id),
      observed_version: 1,
      community_id: nil,
      report_type: "SPAM",
      details: "Please review"
    }

    assert {:ok, report} =
             Repo.transact_result(fn ->
               AlertWall.submit_report_in_transaction(attrs, Ecto.UUID.generate())
             end)

    report
  end

  defp assert_wall_delete_actions(item_ids, operation_ref) do
    Enum.each(item_ids, fn item_id ->
      child_ref = wall_child_operation_ref(operation_ref, item_id)

      assert %Action{item_id: ^item_id, operation_ref: ^child_ref, action: :supersede} =
               Repo.get_by!(Action, operation_ref: child_ref, action: :supersede)
    end)
  end

  defp wall_child_operation_ref(operation_ref, item_id) do
    digest = :crypto.hash(:sha256, "#{operation_ref}:#{item_id}")
    <<uuid::binary-size(16), _rest::binary>> = digest
    Ecto.UUID.load!(uuid)
  end

  defp save_and_publish_mentioner(mentioner_view, community, user, body_json) do
    article = Repo.get!(Article, mentioner_view.id)
    working_copy = Repo.get_by!(ArticleWorkingCopy, article_id: article.id, scope_type: :default)
    public = Repo.get!(ArticlePublic, article.id)

    with {:ok, saved} <-
           CMS.Articles.save_working_copy(
             article,
             community,
             working_copy.id,
             %{body_bag: mock_body_bag(body_json)},
             working_copy.revision,
             user,
             Ecto.UUID.generate()
           ),
         {:ok, _throttle} <-
           CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
             :last_publish_time,
             user,
             minutes: -CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes
           ),
         {:ok, _published} <-
           CMS.Articles.publish_article(
             article,
             community,
             %{working_copy_id: saved.id, revision: saved.revision},
             public.snapshot_id,
             user,
             Ecto.UUID.generate()
           ) do
      {:ok, %{article_id: article.id}}
    end
  end
end
