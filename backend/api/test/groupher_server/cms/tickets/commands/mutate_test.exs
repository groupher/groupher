defmodule GroupherServer.Test.CMS.Tickets.Commands.MutateTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Activity, CMS, Messaging, PublicCache}

  alias CMS.Model.{
    Article,
    ArticleLifecycle,
    ArticlePublic,
    TicketState,
    TicketUpdate
  }

  alias CMS.Tickets.Model.Source
  alias Activity.Model.TicketLog
  alias Activity.Model.PostLog
  alias Messaging.Model.Notification
  alias Messaging.Notifications.Delivery
  alias CMS.Outbox.Event
  alias PublicCache.Tags

  setup do
    {community, post, _attrs, actor} = mock_article(:post)

    grants =
      ~w(ticket.create ticket.link_source ticket.update ticket.transition ticket.assign ticket.manage_case ticket.manage_visibility ticket.read_internal)
      |> Map.new(&{&1, true})

    actor = %{
      actor
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => grants}
        }
    }

    ticket = create_and_publish_ticket(community, post, actor)
    {:ok, %{community: community, post: post, actor: actor, ticket: ticket}}
  end

  @tag :b3_independent
  test "creating a User Ticket records a Post Activity target", %{
    community: community,
    post: post,
    ticket: ticket
  } do
    activity = Repo.get_by!(PostLog, article_id: post.id, action: :ticket_created)

    assert activity.target_type == "ticket"
    assert activity.target_ref == ticket.id

    scoped_post = Map.put(post, :community, community)

    assert {:ok, %{entries: entries}} =
             GroupherServer.Activity.list_article_logs(scoped_post, nil)

    projected = Enum.find(entries, &(&1.action == :ticket_created))

    assert projected.target.type == :ticket
    assert projected.target.ref == ticket.id
    assert projected.target.inner_id == ticket.inner_id
    assert projected.target.url == "/#{community.slug}/ticket/#{ticket.inner_id}"
    assert projected.target.title == ticket.published_content.title
  end

  @tag :b3_independent
  test "ArticleLog hides a Ticket target when the Ticket is no longer public", %{
    community: community,
    post: post,
    ticket: ticket
  } do
    Repo.update_all(
      from(lifecycle in ArticleLifecycle, where: lifecycle.article_id == ^ticket.id),
      set: [state: :draft]
    )

    scoped_post = Map.put(post, :community, community)

    assert {:ok, %{entries: entries}} =
             GroupherServer.Activity.list_article_logs(scoped_post, nil)

    ticket_event = Enum.find(entries, &(&1.action == :ticket_created))

    assert is_nil(ticket_event.target)
  end

  @tag :b3_independent
  test "Post Ticket link Activity records only new relations and survives receipt replay", %{
    community: community,
    actor: actor,
    ticket: ticket
  } do
    {^community, linked_post, _attrs, ^actor} = mock_article(:post, community, actor)
    command_id = Ecto.UUID.generate()
    state = Repo.get!(TicketState, ticket.id)

    assert {:ok, _ticket_id} =
             CMS.Tickets.link_source(
               community,
               ticket.id,
               :post,
               linked_post.id,
               state.workflow_version,
               actor,
               command_id
             )

    assert Repo.aggregate(
             from(log in PostLog,
               where:
                 log.article_id == ^linked_post.id and log.action == :ticket_linked and
                   log.target_ref == ^ticket.id
             ),
             :count
           ) == 1

    assert {:ok, _ticket_id} =
             CMS.Tickets.link_source(
               community,
               ticket.id,
               :post,
               linked_post.id,
               state.workflow_version,
               actor,
               command_id
             )

    current = Repo.get!(TicketState, ticket.id)

    assert {:ok, _ticket_id} =
             CMS.Tickets.link_source(
               community,
               ticket.id,
               :post,
               linked_post.id,
               current.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    assert Repo.aggregate(
             from(log in PostLog,
               where:
                 log.article_id == ^linked_post.id and log.action == :ticket_linked and
                   log.target_ref == ^ticket.id
             ),
             :count
           ) == 1

    source = Repo.get_by!(Source, ticket_id: ticket.id, post_id: linked_post.id)

    assert {:ok, _ticket_id} =
             CMS.Tickets.unlink_source(
               community,
               ticket.id,
               source.id,
               current.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    after_unlink = Repo.get!(TicketState, ticket.id)

    assert {:ok, _ticket_id} =
             CMS.Tickets.link_source(
               community,
               ticket.id,
               :post,
               linked_post.id,
               after_unlink.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    assert Repo.aggregate(
             from(log in PostLog,
               where:
                 log.article_id == ^linked_post.id and log.action == :ticket_linked and
                   log.target_ref == ^ticket.id
             ),
             :count
           ) == 2
  end

  @tag :b3_independent
  test "Ticket creation replay does not append another Post Activity event", %{
    community: community,
    actor: actor
  } do
    {^community, post, _attrs, ^actor} = mock_article(:post, community, actor)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Replay-safe Ticket", digest: "One creation event"}

    assert {:ok, first} =
             CMS.Tickets.create_from_post(community, post.id, attrs, actor, command_id)

    assert {:ok, replayed} =
             CMS.Tickets.create_from_post(community, post.id, attrs, actor, command_id)

    assert replayed.id == first.id

    assert Repo.aggregate(
             from(log in PostLog,
               where:
                 log.article_id == ^post.id and log.action == :ticket_created and
                   log.target_ref == ^first.id
             ),
             :count
           ) == 1
  end

  test "User Ticket starts Draft and Publish selects its current shared Revision", context do
    %{community: community, post: post, actor: actor} = context

    {:ok, draft} =
      CMS.Tickets.create_from_post(
        community,
        post.id,
        %{title: "Drafted ticket", digest: "Draft summary"},
        actor,
        Ecto.UUID.generate()
      )

    assert draft.publication_state == :draft
    assert is_nil(draft.inner_id)
    refute Repo.get(ArticlePublic, draft.id)

    {:ok, internal} = CMS.Tickets.get_internal(community, draft.id, actor)
    publish_command_id = Ecto.UUID.generate()

    assert {:ok, _ticket_id} =
             CMS.Tickets.publish(
               community,
               draft.id,
               "Reviewed first publication",
               internal.draft_version,
               internal.lifecycle_version,
               internal.workflow_version,
               actor,
               publish_command_id,
               CMS.Tickets.Publication.preview_anchor(community.id, draft.id)
             )

    {:ok, published} = CMS.Tickets.get_internal(community, draft.id, actor)
    assert published.publication_state == :published
    assert is_integer(published.inner_id)
    assert published.published_content.title == "Drafted ticket"
    assert Repo.get_by!(ArticleLifecycle, article_id: draft.id).first_published_at

    refute Repo.get_by(Event, command_id: publish_command_id, event: "mention.notify")

    source_endpoint_id =
      Repo.get_by!(CMS.Model.Mentions.Endpoint, type: :ticket, article_id: draft.id).id

    assert Repo.get!(
             CMS.Model.Mentions.Endpoint,
             source_endpoint_id
           ).article_id ==
             draft.id
  end

  test "public Ticket URLs resolve to a stable User Ticket target", %{
    community: community,
    ticket: ticket
  } do
    url = "https://groupher.com/#{community.slug}/ticket/#{ticket.inner_id}"

    ast = [
      %{
        "type" => "p",
        "id" => "ticket-link",
        "children" => [%{"type" => "a", "url" => url, "children" => [%{"text" => "Ticket"}]}]
      }
    ]

    assert {:ok, written} = CMS.ArtimentMentions.Parser.mentions(ast)

    assert {:ok, [%{mentioned_scope: :internal, mentioned_type: :ticket, mentioned_id: id}]} =
             CMS.ArtimentMentions.Commands.Update.target_mentions(written, community.id)

    assert id == ticket.id
  end

  test "single-source Post ReviewBlock downgrades a Ticket and never auto republishes", context do
    %{community: community, post: post, actor: actor, ticket: ticket} = context
    article = Repo.get!(Article, post.id)
    operation_ref = Ecto.UUID.generate()

    assert {:ok, restriction} =
             Repo.transaction(fn ->
               with {:ok, lifecycle} <- CMS.Articles.Lifecycle.lock(article),
                    {:ok, restriction} <-
                      CMS.Articles.Lifecycle.apply_review_block(lifecycle, %{
                        scope_key: "community:#{community.id}",
                        type: :manual_hold,
                        source_ref: "ticket-review:#{operation_ref}",
                        source: :human,
                        actor: actor,
                        applied_at: DateTime.utc_now(:second)
                      }) do
                 restriction
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket)
    assert lifecycle.state == :draft
    visibility_activity = Repo.get_by!(TicketLog, article_id: ticket.id, action: :moved_to_draft)
    assert Map.get(visibility_activity.metadata, "source_type") == "post"
    assert Map.get(visibility_activity.metadata, "visibility_cause") == "post_review_block"
    assert Repo.get(ArticlePublic, ticket.id)
    assert {:error, _reason} = CMS.Tickets.get_public(community, ticket.inner_id)

    assert {:ok, internal} = CMS.Tickets.get_internal(community, ticket.id, actor)
    assert hd(internal.sources).is_public == false
    assert hd(internal.sources).review_block_types == ["manual_hold"]

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               with {:ok, lifecycle} <- CMS.Articles.Lifecycle.lock(article) do
                 CMS.Articles.Lifecycle.end_review_blocks(
                   lifecycle,
                   "community:#{community.id}",
                   [restriction.id],
                   Ecto.UUID.generate(),
                   "review_approved"
                 )
               end
             end)

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft
    assert {:ok, internal} = CMS.Tickets.get_internal(community, ticket.id, actor)
    assert hd(internal.sources).is_public

    assert {:ok, _ticket_id} =
             CMS.Tickets.publish(
               community,
               ticket.id,
               "Explicitly reviewed after source recovery",
               internal.draft_version,
               internal.lifecycle_version,
               internal.workflow_version,
               actor,
               Ecto.UUID.generate(),
               CMS.Tickets.Publication.preview_anchor(community.id, ticket.id)
             )

    assert {:ok, _published} = CMS.Tickets.get_public(community, ticket.inner_id)
  end

  test "Ticket ai_review_hold hides public reads, purges cache and suppresses queued notifications",
       context do
    %{community: community, post: post, actor: actor, ticket: ticket} = context
    article = Repo.get!(Article, ticket.id)
    {:ok, commenter} = db_insert(:user)

    {:ok, _comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment(),
        commenter,
        Ecto.UUID.generate()
      )

    {:ok, current} = CMS.Tickets.get_internal(community, ticket.id, actor)

    assert {:ok, _ticket_id} =
             CMS.Tickets.add_update(
               community,
               ticket.id,
               "Queued before review hold",
               :public,
               nil,
               current.lifecycle_version,
               current.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    queued_update =
      Repo.get_by!(TicketUpdate, ticket_id: ticket.id, body: "Queued before review hold")

    notification_event =
      Enum.find(Repo.all(Event), fn event ->
        event.event == "ticket.notification" and event.resource_id == ticket.id and
          event.data["source_id"] == queued_update.id
      end)

    assert notification_event

    assert {:ok, restriction} =
             Repo.transaction(fn ->
               with {:ok, lifecycle} <- CMS.Articles.Lifecycle.lock(article),
                    {:ok, restriction} <-
                      CMS.Articles.Lifecycle.apply_review_block(lifecycle, %{
                        scope_key: "community:#{community.id}",
                        type: :ai_review_hold,
                        source_ref: "ticket-review:#{Ecto.UUID.generate()}",
                        source: :human,
                        actor: actor,
                        applied_at: DateTime.utc_now(:second)
                      }) do
                 restriction
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state ==
             :published

    assert {:ok, review_blocked_ticket} = CMS.Tickets.get_internal(community, ticket.id, actor)
    refute review_blocked_ticket.can_publish_public_updates
    assert {:error, _reason} = CMS.Tickets.get_public(community, ticket.inner_id)

    assert Enum.any?(Repo.all(Event), fn event ->
             event.event == "ticket.cache_invalidation" and event.resource_id == ticket.id and
               Tags.ticket_list(community.slug) in event.data["cache_tags"] and
               Tags.ticket_detail(community.slug, ticket.inner_id) in event.data["cache_tags"]
           end)

    assert {:error, _reason} =
             CMS.Tickets.add_update(
               community,
               ticket.id,
               "Blocked while review is active",
               :public,
               nil,
               review_blocked_ticket.lifecycle_version,
               review_blocked_ticket.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    refute Repo.get_by(TicketUpdate,
             ticket_id: ticket.id,
             body: "Blocked while review is active"
           )

    assert_raise Postgrex.Error, fn ->
      Repo.query!(
        """
        INSERT INTO cms.ticket_updates (id, ticket_id, body, visibility, author_id, published_at, inserted_at)
        VALUES ($1, $2, 'blocked by review', 'public', $3, now(), now())
        """,
        [Ecto.UUID.dump!(Ecto.UUID.generate()), Ecto.UUID.dump!(ticket.id), actor.id]
      )
    end

    assert {:ok, :pass} = CMS.Tickets.Notifications.deliver(notification_event)

    refute Repo.get_by(Delivery,
             delivery_key: "ticket:#{queued_update.id}:#{commenter.id}:notification"
           )

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               with {:ok, lifecycle} <- CMS.Articles.Lifecycle.lock(article) do
                 CMS.Articles.Lifecycle.end_review_blocks(
                   lifecycle,
                   "community:#{community.id}",
                   [restriction.id],
                   Ecto.UUID.generate(),
                   "ai_review_complete"
                 )
               end
             end)

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state ==
             :published

    assert {:ok, unblocked_ticket} = CMS.Tickets.get_internal(community, ticket.id, actor)
    assert unblocked_ticket.can_publish_public_updates

    assert Enum.count(Repo.all(Event), fn event ->
             event.event == "ticket.cache_invalidation" and event.resource_id == ticket.id and
               Tags.ticket_list(community.slug) in event.data["cache_tags"] and
               Tags.ticket_detail(community.slug, ticket.inner_id) in event.data["cache_tags"]
           end) >= 2
  end

  test "Ticket ReviewBlock other than ai_review_hold moves publication to Draft", context do
    %{community: community, actor: actor, ticket: ticket} = context
    article = Repo.get!(Article, ticket.id)

    assert {:ok, restriction} =
             Repo.transaction(fn ->
               with {:ok, lifecycle} <- CMS.Articles.Lifecycle.lock(article),
                    {:ok, restriction} <-
                      CMS.Articles.Lifecycle.apply_review_block(lifecycle, %{
                        scope_key: "community:#{community.id}",
                        type: :manual_hold,
                        source_ref: "ticket-review:#{Ecto.UUID.generate()}",
                        source: :human,
                        actor: actor,
                        applied_at: DateTime.utc_now(:second)
                      }) do
                 restriction
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft
    assert {:error, _reason} = CMS.Tickets.get_public(community, ticket.inner_id)

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               with {:ok, lifecycle} <- CMS.Articles.Lifecycle.lock(article) do
                 CMS.Articles.Lifecycle.end_review_blocks(
                   lifecycle,
                   "community:#{community.id}",
                   [restriction.id],
                   Ecto.UUID.generate(),
                   "review_approved"
                 )
               end
             end)

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft
    assert {:error, _reason} = CMS.Tickets.get_public(community, ticket.inner_id)
  end

  test "Community becoming non public downgrades a single source and recovery requires explicit Publish",
       context do
    %{community: community, actor: actor, ticket: ticket} = context
    post = context.post

    assert {:ok, _blocker} =
             CMS.Communities.Lifecycle.apply_blocker(
               community.slug,
               %{blocker_type: :moderation_suspend, cause_code: "ticket-source-review"},
               operation_ref: Ecto.UUID.generate()
             )

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft

    assert Enum.any?(Repo.all(Event), fn event ->
             event.event == "ticket.cache_invalidation" and event.resource_id == ticket.id and
               Tags.ticket_detail(community.slug, ticket.inner_id) in event.data["cache_tags"] and
               Tags.article_detail(community.slug, :post, post.inner_id) in event.data[
                 "cache_tags"
               ]
           end)

    assert {:ok, _released} =
             CMS.Communities.Lifecycle.release_blocker(
               community.slug,
               :moderation_suspend,
               nil,
               operation_ref: Ecto.UUID.generate()
             )

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft

    assert Enum.any?(Repo.all(Event), fn event ->
             event.event == "ticket.cache_invalidation" and event.resource_id == ticket.id and
               Tags.ticket_detail(community.slug, ticket.inner_id) in event.data["cache_tags"] and
               Tags.article_detail(community.slug, :post, post.inner_id) in event.data[
                 "cache_tags"
               ]
           end)

    assert {:ok, internal} = CMS.Tickets.get_internal(community, ticket.id, actor)

    assert {:ok, _ticket_id} =
             CMS.Tickets.publish(
               community,
               ticket.id,
               "Reviewed after Community recovery",
               internal.draft_version,
               internal.lifecycle_version,
               internal.workflow_version,
               actor,
               Ecto.UUID.generate(),
               CMS.Tickets.Publication.preview_anchor(community.id, ticket.id)
             )
  end

  test "multi source Ticket remains Published when every Post reference is hidden", context do
    %{community: community, actor: actor, ticket: ticket, post: first_post} = context
    {^community, second_post, _attrs, ^actor} = mock_article(:post, community, actor)

    assert {:ok, _ticket_id} =
             CMS.Tickets.link_source(
               community,
               ticket.id,
               :post,
               second_post.id,
               ticket.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    for post <- [first_post, second_post] do
      article = Repo.get!(Article, post.id)

      assert {:ok, _restriction} =
               Repo.transaction(fn ->
                 with {:ok, lifecycle} <- CMS.Articles.Lifecycle.lock(article),
                      {:ok, restriction} <-
                        CMS.Articles.Lifecycle.apply_review_block(lifecycle, %{
                          scope_key: "community:#{community.id}",
                          type: :manual_hold,
                          source_ref: "ticket-review:#{Ecto.UUID.generate()}",
                          source: :human,
                          actor: actor,
                          applied_at: DateTime.utc_now(:second)
                        }) do
                   restriction
                 else
                   {:error, reason} -> Repo.rollback(reason)
                 end
               end)
    end

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state ==
             :published

    assert {:ok, public_ticket} = CMS.Tickets.get_public(community, ticket.inner_id)
    assert public_ticket.sources == []
  end

  test "report threshold hold moves a single-source Ticket to Draft", context do
    %{community: community, post: post, ticket: ticket} = context
    ticket_state = Repo.get_by!(TicketState, article_id: ticket.id)

    for _ <- 1..3 do
      {:ok, reporter} = db_insert(:user)

      assert {:ok, _report} =
               GroupherServer.AlertWall.Commands.SubmitReport.execute(
                 %{
                   owner: :cms,
                   target_type: :article,
                   target_id: post.id,
                   community_id: community.id,
                   observed_version: 1
                 },
                 :spam,
                 "Please review this Post",
                 reporter,
                 Ecto.UUID.generate()
               )
    end

    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: ticket.id)
    assert lifecycle.state == :draft

    updated_ticket_state = Repo.get_by!(TicketState, article_id: ticket.id)
    assert updated_ticket_state.workflow_version > ticket_state.workflow_version

    assert %TicketLog{action: :moved_to_draft, metadata: metadata} =
             Repo.one!(
               from(log in TicketLog,
                 where: log.article_id == ^ticket.id and log.action == :moved_to_draft,
                 order_by: [desc: log.recorded_at],
                 limit: 1
               )
             )

    assert metadata["visibility_cause"] == "post_review_block"
    assert Repo.exists?(from(event in Event, where: event.event == "ticket.cache_invalidation"))
  end

  test "TicketSource deletion requires the controlled database role", context do
    %{ticket: ticket} = context
    source = Repo.get_by!(Source, ticket_id: ticket.id)

    assert_raise Postgrex.Error, fn ->
      Repo.query!("DELETE FROM cms.ticket_sources WHERE id = $1", [Ecto.UUID.dump!(source.id)])
    end
  end

  test "TicketSource database guards reject unsupported type and identity changes", context do
    %{community: community, actor: actor, ticket: ticket, post: post} = context
    source = Repo.get_by!(Source, ticket_id: ticket.id, post_id: post.id)
    {^community, second_post, _attrs, ^actor} = mock_article(:post, community, actor)

    assert_raise Postgrex.Error, fn ->
      Repo.query!(
        "INSERT INTO cms.ticket_sources (ticket_id, type, post_id) VALUES ($1, 'email', $2)",
        [Ecto.UUID.dump!(ticket.id), Ecto.UUID.dump!(post.id)]
      )
    end

    assert_raise Postgrex.Error, fn ->
      Repo.query!(
        "UPDATE cms.ticket_sources SET post_id = $2 WHERE id = $1",
        [Ecto.UUID.dump!(source.id), Ecto.UUID.dump!(second_post.id)]
      )
    end

    assert Repo.get!(Source, source.id).post_id == post.id
  end

  test "TicketSource database scope guard rejects hidden and cross Community Posts", context do
    %{community: community, actor: actor, ticket: ticket} = context
    {^community, hidden_post, _attrs, ^actor} = mock_article(:post, community, actor)
    {_other_community, foreign_post, _attrs, _other_actor} = mock_article(:post)
    hidden_article = Repo.get!(Article, hidden_post.id)

    assert {:ok, _restriction} =
             Repo.transaction(fn ->
               with {:ok, lifecycle} <- CMS.Articles.Lifecycle.lock(hidden_article),
                    {:ok, restriction} <-
                      CMS.Articles.Lifecycle.apply_review_block(lifecycle, %{
                        scope_key: "community:#{community.id}",
                        type: :manual_hold,
                        source_ref: "ticket-source-review:#{Ecto.UUID.generate()}",
                        source: :human,
                        actor: actor,
                        applied_at: DateTime.utc_now(:second)
                      }) do
                 restriction
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert_raise Postgrex.Error, fn ->
      Repo.query!(
        "INSERT INTO cms.ticket_sources (ticket_id, type, post_id) VALUES ($1, 'post', $2)",
        [Ecto.UUID.dump!(ticket.id), Ecto.UUID.dump!(hidden_post.id)]
      )
    end

    assert_raise Postgrex.Error, fn ->
      Repo.query!(
        "INSERT INTO cms.ticket_sources (ticket_id, type, post_id) VALUES ($1, 'post', $2)",
        [Ecto.UUID.dump!(ticket.id), Ecto.UUID.dump!(foreign_post.id)]
      )
    end
  end

  test "unlink uses the controlled role, captures old Post cache refs and downgrades zero-source Ticket",
       context do
    %{community: community, actor: actor, ticket: ticket, post: post} = context
    source = Repo.get_by!(Source, ticket_id: ticket.id, post_id: post.id)

    assert {:ok, _ticket_id} =
             CMS.Tickets.unlink_source(
               community,
               ticket.id,
               source.id,
               ticket.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    refute Repo.get(Source, source.id)
    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state == :draft

    assert Enum.any?(Repo.all(Event), fn event ->
             event.event == "ticket.cache_invalidation" and
               Tags.article_detail(community.slug, :post, post.inner_id) in event.data[
                 "cache_tags"
               ]
           end)
  end

  test "Ticket cache effects use distinct list and detail tags", context do
    %{community: community, ticket: ticket} = context

    assert Enum.any?(Repo.all(Event), fn event ->
             event.event == "ticket.cache_invalidation" and
               event.resource_id == ticket.id and
               Tags.ticket_list(community.slug) in event.data["cache_tags"] and
               Tags.ticket_detail(community.slug, ticket.inner_id) in event.data["cache_tags"]
           end)
  end

  test "publishing a new Post revision invalidates its linked Ticket cache", context do
    %{community: community, post: post, actor: actor, ticket: ticket} = context
    before_version = Repo.get!(TicketState, ticket.id).workflow_version
    before_preview = CMS.Tickets.Publication.preview_anchor(community.id, ticket.id)
    article = Repo.get!(Article, post.id)
    {:ok, author} = CMS.Articles.Persist.ensure_author_exists(actor)
    {:ok, draft} = CMS.Articles.Draft.Store.ensure_from_public(article, author)

    assert {:ok, updated_draft} =
             CMS.Articles.Draft.Store.update(
               article,
               %{title: "Updated source Post title"},
               author,
               expected_version: draft.version
             )

    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id, thread: :post)
    command_id = Ecto.UUID.generate()

    assert {:ok, _published} =
             CMS.Articles.Workflow.publish(article, author, actor,
               community: community,
               expected_draft_version: updated_draft.version,
               expected_lifecycle_version: lifecycle.version,
               outbox_command_id: command_id
             )

    assert Repo.get!(TicketState, ticket.id).workflow_version > before_version
    refute CMS.Tickets.Publication.preview_anchor(community.id, ticket.id) == before_preview

    assert Enum.any?(Repo.all(Event), fn event ->
             event.event == "ticket.cache_invalidation" and event.resource_id == ticket.id and
               Tags.ticket_detail(community.slug, ticket.inner_id) in event.data["cache_tags"] and
               Tags.article_detail(community.slug, :post, post.inner_id) in event.data[
                 "cache_tags"
               ]
           end)
  end

  test "published updates can be corrected only once and public projection shows the replacement",
       context do
    %{community: community, actor: actor, ticket: ticket} = context
    {:ok, initial} = CMS.Tickets.get_internal(community, ticket.id, actor)

    assert {:error, _reason} =
             CMS.Tickets.add_update(
               community,
               ticket.id,
               "Missing lifecycle version",
               :public,
               ticket.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, _ticket_id} =
             CMS.Tickets.add_update(
               community,
               ticket.id,
               "Original public update",
               :public,
               nil,
               initial.lifecycle_version,
               initial.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    original = Repo.get_by!(TicketUpdate, ticket_id: ticket.id)
    {:ok, updated_ticket} = CMS.Tickets.get_internal(community, ticket.id, actor)

    assert {:ok, _ticket_id} =
             CMS.Tickets.add_update(
               community,
               ticket.id,
               "Corrected public update",
               :public,
               original.id,
               updated_ticket.lifecycle_version,
               updated_ticket.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    correction = Repo.get_by!(TicketUpdate, body: "Corrected public update")
    assert correction.supersedes_id == original.id
    assert {:ok, public_ticket} = CMS.Tickets.get_public(community, ticket.inner_id)
    assert Enum.map(public_ticket.updates, & &1.body) == ["Corrected public update"]

    {:ok, current} = CMS.Tickets.get_internal(community, ticket.id, actor)

    assert {:error, _reason} =
             CMS.Tickets.add_update(
               community,
               ticket.id,
               "Stale second correction",
               :public,
               original.id,
               current.lifecycle_version,
               current.workflow_version,
               actor,
               Ecto.UUID.generate()
             )
  end

  test "public pagination and internal search enforce publication and read scopes", context do
    %{community: community, actor: actor, ticket: ticket} = context
    {^community, second_post, _attrs, ^actor} = mock_article(:post, community, actor)
    second_ticket = create_ticket(community, second_post, actor, "Second ticket result")

    assert {:ok, page} =
             CMS.Tickets.page_public(
               community,
               %{},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 10}
             )

    assert page.page_info.total_count == 1
    assert Enum.map(page.entries, & &1.id) == [to_string(ticket.inner_id)]

    {:ok, internal} = CMS.Tickets.get_internal(community, second_ticket.id, actor)

    assert {:ok, _ticket_id} =
             CMS.Tickets.publish(
               community,
               second_ticket.id,
               "Publish second ticket",
               internal.draft_version,
               internal.lifecycle_version,
               internal.workflow_version,
               actor,
               Ecto.UUID.generate(),
               CMS.Tickets.Publication.preview_anchor(community.id, second_ticket.id)
             )

    assert {:ok, search_page} =
             CMS.Tickets.search_internal(
               community,
               "Second",
               actor,
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 10},
               :user
             )

    assert search_page.page_info.total_count == 1

    unauthorized_actor = %{
      actor
      | cur_passport: %{"global" => %{}, community.slug => %{"cms" => %{}}}
    }

    assert {:error, _reason} = CMS.Tickets.get_internal(community, ticket.id, unauthorized_actor)
  end

  test "completed Ticket reordering preserves completed_at", context do
    %{community: community, actor: actor, ticket: ticket} = context
    completed_at = ~U[2026-10-30 12:34:56Z]

    state = Repo.get!(TicketState, ticket.id)

    {:ok, state} =
      state
      |> TicketState.changeset(%{status: :done, completed_at: completed_at})
      |> Repo.update()

    assert {:ok, _ticket_id} =
             CMS.Tickets.move_ticket(
               community,
               ticket.id,
               :done,
               42,
               state.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    assert Repo.get!(TicketState, ticket.id).completed_at == completed_at
  end

  test "Ticket publication and updates use lifecycle state without TicketEvent or event_id",
       context do
    %{ticket: ticket} = context

    assert {:ok, %{rows: [[nil]]}} = Repo.query("SELECT to_regclass('cms.ticket_events')")

    assert {:ok, %{rows: [[false]]}} =
             Repo.query(
               "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'cms' AND table_name = 'ticket_updates' AND column_name = 'event_id')"
             )

    assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state ==
             :published
  end

  test "ticket notifications deliver to linked Post participants and exclude unrelated subscribers",
       context do
    %{community: community, post: post, actor: actor, ticket: ticket} = context
    {:ok, commenter} = db_insert(:user)
    {:ok, unrelated_subscriber} = db_insert(:user)

    {:ok, _comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment(),
        commenter,
        Ecto.UUID.generate()
      )

    {:ok, _subscription} =
      CMS.Communities.Subscriptions.Setup.subscribe(community, unrelated_subscriber)

    {:ok, current} = CMS.Tickets.get_internal(community, ticket.id, actor)

    assert {:ok, _ticket_id} =
             CMS.Tickets.add_update(
               community,
               ticket.id,
               "Progress for Post participants",
               :public,
               nil,
               current.lifecycle_version,
               current.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    update =
      Repo.get_by!(TicketUpdate, ticket_id: ticket.id, body: "Progress for Post participants")

    event =
      Repo.all(Event)
      |> Enum.find(fn event ->
        event.event == "ticket.notification" and event.resource_id == ticket.id and
          event.data["source_type"] == "ticket_update" and
          event.data["source_id"] == update.id
      end)

    assert event

    assert {:ok, :pass} = CMS.Tickets.Notifications.deliver(event)
    delivery_key = "ticket:#{update.id}:#{commenter.id}:notification"

    assert %Delivery{notification_id: notification_id} =
             Repo.get_by!(Delivery, delivery_key: delivery_key)

    assert Repo.get!(Notification, notification_id).user_id == commenter.id

    refute Repo.get_by(Delivery,
             delivery_key: "ticket:#{update.id}:#{unrelated_subscriber.id}:notification"
           )
  end

  test "Post progress reads real public scopes and distinguishes WIP from TODO", context do
    %{community: community, post: post, actor: actor, ticket: ticket} = context

    for {status, expected} <- [{:todo, :todo}, {:wip, :wip}, {:done, :done}] do
      Repo.update_all(from(state in TicketState, where: state.article_id == ^ticket.id),
        set: [status: status]
      )

      assert {:ok, progress} = CMS.Tickets.post_progress(community, [post.inner_id])
      assert progress[post.inner_id].status == expected
    end

    Repo.update_all(from(state in TicketState, where: state.article_id == ^ticket.id),
      set: [status: :wip]
    )

    second = create_and_publish_ticket(community, post, actor)
    assert {:ok, progress} = CMS.Tickets.post_progress(community, [post.inner_id])
    assert progress[post.inner_id].status == :wip
    assert progress[post.inner_id].total == 2
    assert {:ok, %{}} = CMS.Tickets.post_progress(community, [])
    {^community, other, _, ^actor} = mock_article(:post, community, actor)

    for entry <- [ticket, second] do
      {:ok, current} = CMS.Tickets.get_internal(community, entry.id, actor)

      assert {:ok, _} =
               CMS.Tickets.link_source(
                 community,
                 entry.id,
                 :post,
                 other.id,
                 current.workflow_version,
                 actor,
                 Ecto.UUID.generate()
               )
    end

    before = Repo.get!(TicketState, ticket.id).workflow_version
    article = Repo.get!(Article, post.id)

    assert {:ok, _} =
             Repo.transaction(fn ->
               {:ok, lifecycle} = CMS.Articles.Lifecycle.lock(article)

               {:ok, restriction} =
                 CMS.Articles.Lifecycle.apply_review_block(lifecycle, %{
                   scope_key: "community:#{community.id}",
                   type: :manual_hold,
                   source_ref: Ecto.UUID.generate(),
                   source: :human,
                   actor: actor,
                   applied_at: DateTime.utc_now(:second)
                 })

               restriction
             end)

    assert Repo.get!(TicketState, ticket.id).workflow_version > before
    assert {:ok, %{}} = CMS.Tickets.post_progress(community, [post.inner_id])
  end

  test "mirrored Post can create Tickets in both Communities and global deletion clears both",
       context do
    %{community: community, post: post, actor: actor, ticket: first} = context
    {:ok, other} = mock_community(actor)
    article = Repo.get!(Article, post.id)

    assert {:ok, _} =
             Repo.transaction(fn ->
               {:ok, binding} = CMS.Articles.BindingPersist.mirror(article, other)
               binding
             end)

    grants =
      Map.merge(get_in(actor.cur_passport, [community.slug, "cms"]), %{
        "post.restore" => true,
        "post.permanent_delete" => true
      })

    actor = %{
      actor
      | cur_passport:
          actor.cur_passport
          |> Map.put(community.slug, %{"cms" => grants})
          |> Map.put(other.slug, %{"cms" => grants})
    }

    second = create_and_publish_ticket(other, post, actor)
    assert second.publication_state == :published
    assert {:ok, item} = CMS.Articles.trash(post, actor, community: community)

    for id <- [first.id, second.id],
        do: assert(Repo.get_by!(ArticleLifecycle, article_id: id).state == :draft)

    assert {:ok, _} = CMS.Articles.restore_trashed(item.hash_id, actor)

    for id <- [first.id, second.id],
        do: assert(Repo.get_by!(ArticleLifecycle, article_id: id).state == :draft)

    assert {:ok, item} = CMS.Articles.trash(post, actor, community: community)
    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, actor)
    refute Repo.get(Article, post.id)
    refute Repo.exists?(from(source in Source, where: source.post_id == ^post.id))
  end

  test "Publish rejects a preview anchor different from the reviewed source set", context do
    %{community: community, actor: actor, ticket: ticket} = context

    assert {:ok, _} =
             CMS.Tickets.ensure_draft(
               community,
               ticket.id,
               ticket.lifecycle_version,
               actor,
               Ecto.UUID.generate()
             )

    {:ok, current} = CMS.Tickets.get_internal(community, ticket.id, actor)

    assert {:error, _} =
             CMS.Tickets.publish(
               community,
               ticket.id,
               "Review",
               current.draft_version,
               current.lifecycle_version,
               current.workflow_version,
               actor,
               Ecto.UUID.generate(),
               "stale-preview"
             )

    revision_count =
      Repo.aggregate(
        from(revision in CMS.Model.ArticleRevision, where: revision.article_id == ^ticket.id),
        :count
      )

    assert {:ok, _} =
             CMS.Tickets.publish(
               community,
               ticket.id,
               "Review",
               current.draft_version,
               current.lifecycle_version,
               current.workflow_version,
               actor,
               Ecto.UUID.generate(),
               current.publication_preview
             )

    assert Repo.aggregate(
             from(revision in CMS.Model.ArticleRevision,
               where: revision.article_id == ^ticket.id
             ),
             :count
           ) == revision_count
  end

  test "publication notification uses a Messaging-supported action", context do
    %{community: community, actor: actor, post: post, ticket: ticket} = context
    {:ok, commenter} = db_insert(:user)

    {:ok, _} =
      CMS.Comments.create_comment(
        community,
        :post,
        post.inner_id,
        mock_comment(),
        commenter,
        Ecto.UUID.generate()
      )

    events =
      Repo.all(
        from(event in Event,
          where: event.resource_id == ^ticket.id and event.event == "ticket.notification"
        )
      )

    assert events != []
    for event <- events, do: assert({:ok, :pass} = CMS.Tickets.Notifications.deliver(event))
    assert Repo.get_by!(Notification, user_id: commenter.id).action == "TICKET_VISIBILITY"
    assert actor.id != commenter.id
  end

  test "public Update Activity records publication and supersede once per command", context do
    %{community: community, actor: actor, ticket: ticket} = context
    {:ok, initial} = CMS.Tickets.get_internal(community, ticket.id, actor)
    published_command = Ecto.UUID.generate()

    for _attempt <- 1..2 do
      assert {:ok, _ticket} =
               CMS.Tickets.add_update(
                 community,
                 ticket.id,
                 "Published activity update",
                 :public,
                 nil,
                 initial.lifecycle_version,
                 initial.workflow_version,
                 actor,
                 published_command
               )
    end

    original = Repo.get_by!(TicketUpdate, ticket_id: ticket.id, body: "Published activity update")
    published = Repo.get_by!(TicketLog, article_id: ticket.id, operation_ref: published_command)
    assert published.action == :public_update_published
    assert published.payload == %{"update_id" => original.id}
    assert published.actor_type == :user
    assert published.actor_ref == actor.login
    assert published.community_id == community.id
    assert published.source == :api

    {:ok, current} = CMS.Tickets.get_internal(community, ticket.id, actor)
    corrected_command = Ecto.UUID.generate()

    for _attempt <- 1..2 do
      assert {:ok, _ticket} =
               CMS.Tickets.add_update(
                 community,
                 ticket.id,
                 "Corrected activity update",
                 :public,
                 original.id,
                 current.lifecycle_version,
                 current.workflow_version,
                 actor,
                 corrected_command
               )
    end

    correction =
      Repo.get_by!(TicketUpdate, ticket_id: ticket.id, body: "Corrected activity update")

    superseded = Repo.get_by!(TicketLog, article_id: ticket.id, operation_ref: corrected_command)
    assert superseded.action == :public_update_superseded
    assert superseded.payload == %{"update_id" => correction.id, "supersedes_id" => original.id}
    assert superseded.actor_ref == actor.login
    assert superseded.community_id == community.id

    assert Repo.aggregate(
             from(update in TicketUpdate, where: update.ticket_id == ^ticket.id),
             :count
           ) == 2

    assert Repo.get!(TicketState, ticket.id).workflow_version == initial.workflow_version + 2

    for command_id <- [published_command, corrected_command] do
      assert Repo.aggregate(
               from(log in TicketLog, where: log.operation_ref == ^command_id),
               :count
             ) == 1

      assert Repo.aggregate(
               from(event in Event,
                 where: event.command_id == ^command_id and event.event == "ticket.notification"
               ),
               :count
             ) == 1
    end

    assert {:ok, history} = CMS.Tickets.activity_internal(community, ticket.id, actor)

    assert Enum.find(history.entries, &(&1.id == published.event_ref)).payload ==
             published.payload

    assert Enum.find(history.entries, &(&1.id == superseded.event_ref)).payload ==
             superseded.payload

    assert GroupherServer.Activity.Ticket.surface_actions(:article_log) == []
    assert GroupherServer.Activity.Ticket.surface_actions(:community_log) == []
    unauthorized = %{actor | cur_passport: %{"global" => %{}, community.slug => %{"cms" => %{}}}}
    assert {:error, _} = CMS.Tickets.activity_internal(community, ticket.id, unauthorized)
  end

  test "internal Updates do not append public Update Activity or notifications", context do
    %{community: community, actor: actor, ticket: ticket} = context
    before_logs = Repo.aggregate(TicketLog, :count)
    before_events = Repo.aggregate(Event, :count)
    command_id = Ecto.UUID.generate()

    assert {:ok, _ticket} =
             CMS.Tickets.add_update(
               community,
               ticket.id,
               "Private investigation",
               :internal,
               nil,
               nil,
               ticket.workflow_version,
               actor,
               command_id
             )

    assert Repo.get_by!(TicketUpdate, ticket_id: ticket.id).visibility == :internal
    assert Repo.aggregate(TicketLog, :count) == before_logs
    assert Repo.aggregate(Event, :count) == before_events
    assert Repo.get!(TicketState, ticket.id).workflow_version == ticket.workflow_version + 1
  end

  test "Worker creation records created on its own stream exactly once", context do
    %{community: community, actor: actor, ticket: ticket} = context
    command_id = Ecto.UUID.generate()

    assert {:ok, worker} =
             CMS.Tickets.create_worker(
               community,
               ticket.id,
               %{title: "Tracked Worker"},
               ticket.workflow_version,
               actor,
               command_id
             )

    assert {:ok, replayed} =
             CMS.Tickets.create_worker(
               community,
               ticket.id,
               %{title: "Tracked Worker"},
               ticket.workflow_version,
               actor,
               command_id
             )

    assert replayed.id == worker.id
    assert Repo.get!(TicketState, ticket.id).workflow_version == ticket.workflow_version + 1
    log = Repo.get_by!(TicketLog, article_id: worker.id, action: :created)
    assert log.operation_ref == command_id
    assert log.actor_type == :user
    assert log.actor_ref == actor.login
    assert log.community_id == community.id
    assert log.source == :api

    assert Repo.aggregate(from(log in TicketLog, where: log.operation_ref == ^command_id), :count) ==
             1

    assert Repo.aggregate(
             from(relation in CMS.Model.TicketWorker,
               where: relation.worker_ticket_id == ^worker.id
             ),
             :count
           ) == 1

    assert {:ok, history} = CMS.Tickets.activity_internal(community, worker.id, actor)
    assert Enum.map(history.entries, & &1.action) == [:created]
  end

  test "failed public Update Activity rolls back the Update, version and Outbox", context do
    %{community: community, actor: actor, ticket: ticket} = context

    assert {:ok, _} =
             CMS.Tickets.add_update(
               community,
               ticket.id,
               "Valid original",
               :public,
               nil,
               ticket.lifecycle_version,
               ticket.workflow_version,
               actor,
               Ecto.UUID.generate()
             )

    original = Repo.get_by!(TicketUpdate, ticket_id: ticket.id)
    {:ok, current} = CMS.Tickets.get_internal(community, ticket.id, actor)
    before_state = Repo.get!(TicketState, ticket.id)
    before_logs = Repo.aggregate(TicketLog, :count)
    before_events = Repo.aggregate(Event, :count)

    Repo.query!("""
    ALTER TABLE activity.ticket_logs ADD CONSTRAINT ticket_update_activity_failure_test
      CHECK (action NOT IN ('public_update_published', 'public_update_superseded')) NOT VALID
    """)

    try do
      for supersedes_id <- [nil, original.id] do
        assert {:error, _} =
                 CMS.Tickets.add_update(
                   community,
                   ticket.id,
                   "Must roll back",
                   :public,
                   supersedes_id,
                   current.lifecycle_version,
                   current.workflow_version,
                   actor,
                   Ecto.UUID.generate()
                 )

        assert Repo.get!(TicketState, ticket.id) == before_state

        assert Repo.all(from(update in TicketUpdate, where: update.ticket_id == ^ticket.id)) == [
                 original
               ]

        assert Repo.aggregate(TicketLog, :count) == before_logs
        assert Repo.aggregate(Event, :count) == before_events
      end
    after
      Repo.query!(
        "ALTER TABLE activity.ticket_logs DROP CONSTRAINT ticket_update_activity_failure_test"
      )
    end
  end

  test "failed Worker created Activity rolls back the aggregate and parent effects", context do
    %{community: community, actor: actor, ticket: ticket} = context
    before_state = Repo.get!(TicketState, ticket.id)

    models = [
      Article,
      CMS.Model.ArticleDraft,
      CMS.Model.ArticleBodyDraft,
      TicketState,
      CMS.Model.TicketWorker,
      CMS.Model.ArticleAssetRef,
      TicketLog,
      Event
    ]

    counts = Map.new(models, fn model -> {model, Repo.aggregate(model, :count)} end)

    Repo.query!("""
    ALTER TABLE activity.ticket_logs ADD CONSTRAINT ticket_worker_activity_failure_test
      CHECK (action <> 'created') NOT VALID
    """)

    try do
      assert {:error, _} =
               CMS.Tickets.create_worker(
                 community,
                 ticket.id,
                 %{title: "Must roll back Worker"},
                 ticket.workflow_version,
                 actor,
                 Ecto.UUID.generate()
               )

      assert Repo.get!(TicketState, ticket.id) == before_state
      for {model, count} <- counts, do: assert(Repo.aggregate(model, :count) == count)
    after
      Repo.query!(
        "ALTER TABLE activity.ticket_logs DROP CONSTRAINT ticket_worker_activity_failure_test"
      )
    end
  end

  test "Ticket Activity rejects legacy Update actions at the database boundary", context do
    log = Repo.get_by!(TicketLog, article_id: context.ticket.id, action: :created)
    actions = Ecto.Enum.values(TicketLog, :action)
    contracts = GroupherServer.Activity.Ticket.contracts()

    for action <- [:public_update_published, :public_update_superseded] do
      assert action in actions
      assert Map.has_key?(contracts, action)
    end

    for action <- ["update_added", "update_superseded"] do
      refute action in Enum.map(actions, &Atom.to_string/1)

      assert {:error, %Postgrex.Error{postgres: %{constraint: "ticket_logs_action_check"}}} =
               Repo.transaction(fn ->
                 case Repo.query("UPDATE activity.ticket_logs SET action = $1 WHERE id = $2", [
                        action,
                        log.id
                      ]) do
                   {:error, error} -> Repo.rollback(error)
                   {:ok, _} -> flunk("accepted a legacy Ticket Update action")
                 end
               end)
    end
  end

  defp create_ticket(community, post, actor, title \\ "Ticket #{Ecto.UUID.generate()}") do
    {:ok, ticket} =
      CMS.Tickets.create_from_post(
        community,
        post.id,
        %{title: title, digest: "Ticket summary"},
        actor,
        Ecto.UUID.generate()
      )

    ticket
  end

  defp create_and_publish_ticket(community, post, actor) do
    ticket = create_ticket(community, post, actor)
    {:ok, internal} = CMS.Tickets.get_internal(community, ticket.id, actor)

    {:ok, _ticket_id} =
      CMS.Tickets.publish(
        community,
        ticket.id,
        "Reviewed initial publication",
        internal.draft_version,
        internal.lifecycle_version,
        internal.workflow_version,
        actor,
        Ecto.UUID.generate(),
        CMS.Tickets.Publication.preview_anchor(community.id, ticket.id)
      )

    {:ok, published} = CMS.Tickets.get_internal(community, ticket.id, actor)
    published
  end
end
