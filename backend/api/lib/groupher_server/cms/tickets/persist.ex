defmodule GroupherServer.CMS.Tickets.Persist do
  @moduledoc """
  Persists Ticket changes within an authorized Command transaction.

  Stable Article identity, TicketState and its Activity are changed in one receipt
  transaction. Public User Tickets share the existing Community numbering
  counter; Worker and Case identities stay internal.

      Ticket intent + actor
        -> authorized caller-owned transaction
        -> transactional Article/Ticket facts, Activity and Outbox effects
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias CMS.Artiment.BodyBag
  alias Accounts.Model.User
  alias CMS.Articles.{Numbering, Persist}
  alias CMS.ArtimentMentions.{GraphRevision, SyncProgress}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleBodyDraft,
    ArticleBodySnapshot,
    ArticleLifecycle,
    ArticlePublic,
    ArticleRevision,
    ArticleReviewBlock,
    Author,
    Community,
    CommunityModerator,
    CommunityTag,
    TicketCaseMember,
    TicketCaseWorker,
    TicketAssignee,
    TicketFacet,
    TicketState,
    TicketTag,
    TicketUpdate,
    TicketWorker
  }

  alias CMS.Tickets.{ErrorCat, PublicPosts, Lifecycle}
  alias CMS.Tickets.Model.Source, as: TicketSource
  alias CMS.Tickets.Notifications
  alias GroupherServer.Activity.Model.TicketLog

  @doc "Reconciles every Ticket linked to a Post that became hidden."
  def hold_linked_to_post(community, post_id, actor, command_id, visibility_cause \\ "post_trash")
      when is_binary(post_id) and is_binary(command_id) and is_binary(visibility_cause) do
    states =
      from(state in TicketState,
        as: :ticket_state,
        join: link in TicketSource,
        on: link.ticket_id == state.article_id,
        join: binding in ArticleBinding,
        on: binding.id == state.article_binding_id and binding.community_id == ^community.id,
        join: article in Article,
        on: article.id == state.article_id and article.thread == :ticket,
        join: lifecycle in ArticleLifecycle,
        on: lifecycle.article_id == article.id and lifecycle.thread == :ticket,
        where: link.post_id == ^post_id and state.type == :user,
        order_by: [asc: state.article_id],
        lock: "FOR UPDATE",
        select: {state, binding, article, lifecycle}
      )
      |> Repo.all()

    Enum.reduce_while(states, {:ok, :pass}, fn {state, binding, article, lifecycle}, {:ok, _} ->
      link_count =
        Repo.aggregate(
          from(link in TicketSource, where: link.ticket_id == ^state.article_id),
          :count
        )

      with {:ok, state} <- Lifecycle.increment_version(state),
           {:ok, state, _lifecycle} <-
             maybe_move_single_source_to_draft(
               community,
               state,
               article,
               binding,
               lifecycle,
               link_count,
               actor,
               command_id,
               visibility_cause,
               post_id
             ),
           {:ok, _cache} <-
             invalidate_user_ticket_cache(
               community,
               state,
               binding,
               command_id,
               "ticket_visibility:#{visibility_cause}:#{post_id}"
             ) do
        {:cont, {:ok, :pass}}
      else
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  @doc "Enqueues cache invalidations for every User Ticket linked to a Post."
  def invalidate_cache_linked_to_post(community, post_id, command_id, effect_key)
      when is_binary(post_id) and (is_binary(command_id) or is_tuple(command_id)) and
             is_binary(effect_key) do
    states =
      from(state in TicketState,
        join: link in TicketSource,
        on: link.ticket_id == state.article_id,
        join: binding in ArticleBinding,
        on: binding.id == state.article_binding_id and binding.community_id == ^community.id,
        where: link.post_id == ^post_id and state.type == :user,
        order_by: [asc: state.article_id],
        lock: "FOR UPDATE OF t0",
        select: {state, binding}
      )
      |> Repo.all()

    Enum.reduce_while(states, {:ok, :pass}, fn {state, binding}, {:ok, _} ->
      with {:ok, state} <- Lifecycle.increment_version(state),
           {:ok, _cache} <-
             invalidate_user_ticket_cache(community, state, binding, command_id, effect_key) do
        {:cont, {:ok, :pass}}
      else
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  @doc "Unlinks all Ticket sources before a Post is permanently deleted, in the caller transaction."
  def unlink_sources_for_post_in_transaction(
        %Community{} = community,
        post_id,
        actor,
        command_id
      )
      when is_binary(post_id) and is_binary(command_id) do
    with {:ok, _post, _post_binding} <- lock_post_source(community, post_id) do
      links =
        from(link in TicketSource,
          join: state in TicketState,
          on: state.article_id == link.ticket_id and state.type == :user,
          join: binding in ArticleBinding,
          on: binding.id == state.article_binding_id,
          join: owner in Community,
          on: owner.id == binding.community_id,
          where: link.type == :post and link.post_id == ^post_id,
          order_by: [asc: link.ticket_id],
          select: {link, owner}
        )
        |> Repo.all()

      Enum.reduce_while(links, {:ok, :pass}, fn {link, owner}, {:ok, :pass} ->
        post_binding = Repo.get_by!(ArticleBinding, article_id: post_id, community_id: owner.id)

        with {:ok, state, article, ticket_binding} <- lock_state(owner, link.ticket_id),
             {:ok, :pass} <-
               unlink_source_in_transaction(
                 owner,
                 state,
                 article,
                 ticket_binding,
                 link,
                 post_binding.inner_id,
                 actor,
                 command_id,
                 "post_permanently_deleted"
               ) do
          {:cont, {:ok, :pass}}
        else
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    end
  end

  def unlink_sources_for_post_in_transaction(_community, _post_id, _actor, _command_id) do
    {:error, ErrorCat.invalid_ticket_content()}
  end

  @doc "Advances the internal lifecycle version and cache after a Ticket ReviewBlock changes."
  def review_block_changed(%Community{} = community, ticket_id, actor, command_id, effect_key)
      when is_binary(ticket_id) and is_binary(command_id) and is_binary(effect_key) do
    with {:ok, state, article, binding} <- lock_state(community, ticket_id),
         {:ok, lifecycle} <- lock_ticket_lifecycle(article),
         {:ok, lifecycle} <-
           reconcile_ticket_review_lifecycle(state, article, lifecycle, actor, command_id),
         {:ok, _cache} <-
           invalidate_user_ticket_cache(community, state, binding, command_id, effect_key) do
      {:ok, lifecycle}
    end
  end

  defp unlink_source_in_transaction(
         community,
         state,
         article,
         binding,
         link,
         old_post_inner_id,
         actor,
         command_id,
         effect_key
       ) do
    with {:ok, _deleted} <- CMS.Tickets.SourceWriter.delete(link),
         {:ok, updated_state} <- Lifecycle.increment_version(state),
         {:ok, lifecycle} <- lock_ticket_lifecycle(article),
         {:ok, _lifecycle} <-
           reconcile_after_source_change(
             community,
             updated_state,
             article,
             lifecycle,
             actor,
             link.post_id,
             command_id
           ),
         {:ok, _activity} <-
           log_ticket_activity(article, :source_unlinked, actor, command_id,
             metadata: %{
               ticket_source_id: link.id,
               source_type: "post",
               source_id: link.post_id
             }
           ),
         {:ok, _cache} <-
           invalidate_user_ticket_cache(
             community,
             updated_state,
             binding,
             command_id,
             effect_key,
             [old_post_inner_id]
           ) do
      {:ok, :pass}
    end
  end

  defp reconcile_after_source_change(
         community,
         _state,
         article,
         %ArticleLifecycle{state: :published} = lifecycle,
         actor,
         post_id,
         command_id
       ) do
    remaining_count =
      Repo.aggregate(
        from(link in TicketSource, where: link.ticket_id == ^article.id),
        :count
      )

    should_move_to_draft? =
      remaining_count == 0 or
        (remaining_count == 1 and not all_linked_posts_public?(community.id, article.id))

    if should_move_to_draft? do
      with {:ok, author} <- review_author(article, actor),
           {:ok, _draft} <-
             CMS.Tickets.Content.ensure_workspace(article, author,
               expected_lifecycle_version: lifecycle.version
             ),
           {:ok, updated_lifecycle} <- CMS.Articles.Lifecycle.transition(lifecycle, :draft),
           {:ok, _activity} <-
             log_ticket_activity(article, :moved_to_draft, actor, command_id,
               metadata: %{
                 lifecycle_version: updated_lifecycle.version,
                 reason: "ticket_source_unlinked",
                 source_type: "post",
                 source_id: post_id
               }
             ) do
        {:ok, updated_lifecycle}
      end
    else
      {:ok, lifecycle}
    end
  end

  defp reconcile_after_source_change(
         _community,
         _state,
         _article,
         lifecycle,
         _actor,
         _post_id,
         _command_id
       ) do
    {:ok, lifecycle}
  end

  defp maybe_move_single_source_to_draft(
         _community,
         state,
         _article,
         _binding,
         lifecycle,
         link_count,
         _actor,
         _command_id,
         _visibility_cause,
         _post_id
       )
       when link_count != 1 or lifecycle.state != :published do
    {:ok, state, lifecycle}
  end

  defp maybe_move_single_source_to_draft(
         _community,
         state,
         article,
         _binding,
         lifecycle,
         1,
         actor,
         command_id,
         visibility_cause,
         post_id
       ) do
    with {:ok, author} <- review_author(article, actor),
         {:ok, _draft} <-
           CMS.Tickets.Content.ensure_workspace(article, author,
             expected_lifecycle_version: lifecycle.version
           ),
         {:ok, updated_lifecycle} <- CMS.Articles.Lifecycle.transition(lifecycle, :draft),
         {:ok, _activity} <-
           log_ticket_activity(article, :moved_to_draft, actor, command_id,
             metadata: %{
               lifecycle_version: updated_lifecycle.version,
               reason: "linked_post_hidden",
               source_type: "post",
               visibility_cause: visibility_cause,
               source_id: post_id
             }
           ) do
      {:ok, state, updated_lifecycle}
    end
  end

  defp reconcile_ticket_review_lifecycle(state, article, lifecycle, actor, command_id) do
    active_types =
      from(block in ArticleReviewBlock,
        where: block.article_id == ^article.id and is_nil(block.resolved_at),
        select: block.type
      )
      |> Repo.all()

    target_state =
      if state.type == :user and lifecycle.state == :published and
           Enum.any?(active_types, &(&1 != :awaiting_ai)) do
        :draft
      else
        lifecycle.state
      end

    with {:ok, _draft} <- maybe_ensure_ticket_draft(article, lifecycle, target_state, actor),
         {:ok, updated_lifecycle} <- CMS.Articles.Lifecycle.transition(lifecycle, target_state),
         {:ok, _activity} <-
           maybe_log_ticket_review_downgrade(
             article,
             lifecycle,
             updated_lifecycle,
             target_state,
             actor,
             command_id
           ) do
      {:ok, updated_lifecycle}
    end
  end

  defp maybe_ensure_ticket_draft(article, lifecycle, :draft, actor)
       when lifecycle.state == :published do
    with {:ok, author} <- review_author(article, actor),
         {:ok, draft} <-
           CMS.Tickets.Content.ensure_workspace(article, author,
             expected_lifecycle_version: lifecycle.version
           ) do
      {:ok, draft}
    end
  end

  defp maybe_ensure_ticket_draft(_article, _lifecycle, _target_state, _actor) do
    {:ok, :pass}
  end

  defp maybe_log_ticket_review_downgrade(
         article,
         %ArticleLifecycle{state: :published},
         %ArticleLifecycle{state: :draft} = lifecycle,
         :draft,
         actor,
         operation_ref
       ) do
    log_ticket_activity(article, :moved_to_draft, actor, operation_ref,
      metadata: %{
        lifecycle_version: lifecycle.version,
        reason: "ticket_review_block"
      }
    )
  end

  defp maybe_log_ticket_review_downgrade(
         _article,
         _lifecycle,
         _updated_lifecycle,
         _target_state,
         _actor,
         _operation_ref
       ) do
    {:ok, :pass}
  end

  defp review_author(_article, %User{} = actor), do: Persist.ensure_author_exists(actor)

  defp review_author(%Article{author_id: author_id}, _actor) do
    case Repo.get(Author, author_id) do
      %Author{} = author -> {:ok, author}
      nil -> {:error, ErrorCat.not_found()}
    end
  end

  @doc false
  def create_user(community, post_id, attrs, context) do
    with {:ok, post, _public, revision, _post_binding} <- lock_public_post(community, post_id),
         %ArticleBodySnapshot{} = body <- Repo.get(ArticleBodySnapshot, revision.body_snapshot_id),
         {:ok, body_bag} <- BodyBag.from_document(body),
         {:ok, author} <- Persist.ensure_author_exists(context.actor),
         {:ok, %{article: article, draft: draft}} <-
           CMS.Tickets.Content.create_workspace(
             community,
             %{
               title: attr_or_source(attrs, :title, revision.title),
               digest: attr_or_source(attrs, :digest, revision.digest),
               body_bag: body_bag
             },
             author
           ),
         {:ok, :pass} <- CMS.Tickets.Content.clone_revision_refs(post, revision, article, draft),
         {:ok, ticket_binding} <- CMS.Articles.Bindings.fetch_binding(article.id, community.id),
         {:ok, _state} <- insert_state(article, ticket_binding, :user, :todo),
         {:ok, _link} <- insert_post_link(article, post),
         {:ok, _activity} <-
           insert_created_activity(article, context.actor, context.command_id) do
      {:ok, article.id}
    else
      nil -> {:error, ErrorCat.invalid_ticket_content()}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc false
  def create_worker(community, parent_id, attrs, expected_version, context) do
    with {:ok, parent_state, parent, parent_binding} <- lock_state(community, parent_id),
         true <- parent_state.type == :user,
         {:ok, :pass} <- Lifecycle.ensure_version(parent_state, expected_version),
         false <- parent_state.status == :done,
         {:ok, parent_content} <- ticket_content_for_clone(parent),
         {:ok, author} <- Persist.ensure_author_exists(context.actor),
         {:ok, %{article: article, draft: draft}} <-
           CMS.Tickets.Content.create_workspace(
             community,
             parent_content
             |> Map.take([:title, :digest, :body_bag])
             |> Map.merge(Map.take(attrs, [:title, :digest])),
             author
           ),
         {:ok, :pass} <- clone_parent_ticket_refs(parent, parent_content, article, draft),
         {:ok, binding} <- CMS.Articles.Bindings.fetch_binding(article.id, community.id),
         {:ok, _state} <- insert_state(article, binding, :worker, :todo),
         {:ok, _relation} <- insert_worker(parent.id, article.id),
         {:ok, _activity} <-
           insert_created_activity(article, context.actor, context.command_id),
         {:ok, parent_state} <- Lifecycle.increment_version(parent_state),
         {:ok, _cache} <-
           invalidate_user_ticket_cache(
             community,
             parent_state,
             parent_binding,
             context.command_id,
             "ticket_worker_created"
           ) do
      {:ok, article.id}
    else
      true -> {:error, ErrorCat.parent_ticket_done()}
      false -> {:error, ErrorCat.invalid_ticket_type()}
      error -> error
    end
  end

  @doc false
  def create_case(community, attrs, context) do
    with {:ok, title} <- required_title(attrs),
         {:ok, author} <- Persist.ensure_author_exists(context.actor),
         {:ok, body_bag} <- ticket_body_bag(attrs),
         {:ok, %{article: article}} <-
           CMS.Tickets.Content.create_workspace(
             community,
             %{
               title: title,
               digest: Map.get(attrs, :digest) || Map.get(attrs, "digest"),
               body_bag: body_bag
             },
             author
           ),
         {:ok, binding} <- CMS.Articles.Bindings.fetch_binding(article.id, community.id),
         {:ok, _state} <- insert_state(article, binding, :case, :open),
         {:ok, _activity} <-
           insert_created_activity(article, context.actor, context.command_id) do
      case value(attrs, :member_ticket_id) do
        nil ->
          {:ok, article.id}

        ticket_id when is_binary(ticket_id) ->
          with {:ok, member_ticket, _member_revision} <- lock_ticket(community, ticket_id, :user),
               {:ok, _member, _changed?} <- insert_case_member(article.id, member_ticket.id) do
            {:ok, article.id}
          end

        _ ->
          {:error, ErrorCat.invalid_ticket_type()}
      end
    end
  end

  @doc false
  def add_case_member(community, case_id, ticket_id, expected_version, _context) do
    with {:ok, case_state, _case_article, _case_binding} <- lock_state(community, case_id),
         true <- case_state.type == :case,
         {:ok, :pass} <- Lifecycle.ensure_version(case_state, expected_version),
         {:ok, user_ticket, _revision} <- lock_ticket(community, ticket_id, :user),
         {:ok, _member, changed?} <- insert_case_member(case_id, user_ticket.id),
         {:ok, _case_state} <- maybe_increment_version(case_state, changed?) do
      {:ok, case_id}
    else
      false -> {:error, ErrorCat.invalid_ticket_type()}
      error -> error
    end
  end

  @doc false
  def remove_case_member(community, case_id, ticket_id, expected_version, _context) do
    with {:ok, case_state, _case_article, _case_binding} <- lock_state(community, case_id),
         true <- case_state.type == :case,
         {:ok, :pass} <- Lifecycle.ensure_version(case_state, expected_version),
         {:ok, member_ticket, _revision} <- lock_ticket(community, ticket_id, :user) do
      case Repo.get_by(TicketCaseMember,
             case_ticket_id: case_id,
             user_ticket_id: member_ticket.id
           ) do
        nil ->
          {:ok, case_id}

        %TicketCaseMember{} = member ->
          with {:ok, _deleted} <- Repo.delete(member),
               {:ok, _deleted_count} <- delete_case_worker_refs(case_id, member_ticket.id),
               {:ok, _case_state} <- Lifecycle.increment_version(case_state) do
            {:ok, case_id}
          end
      end
    else
      false -> {:error, ErrorCat.invalid_ticket_type()}
      error -> error
    end
  end

  @doc false
  def add_case_worker(community, case_id, worker_id, expected_version, _context) do
    with {:ok, case_state, _case_article, _case_binding} <- lock_state(community, case_id),
         true <- case_state.type == :case,
         {:ok, :pass} <- Lifecycle.ensure_version(case_state, expected_version),
         {:ok, worker_article, _revision} <- lock_ticket(community, worker_id, :worker),
         true <- case_worker_is_member_owned?(case_id, worker_id),
         {:ok, _relation, changed?} <- insert_case_worker(case_id, worker_article.id),
         {:ok, _case_state} <- maybe_increment_version(case_state, changed?) do
      {:ok, case_id}
    else
      false -> {:error, ErrorCat.invalid_ticket_type()}
      error -> error
    end
  end

  @doc false
  def set_assignees(community, ticket_id, user_ids, expected_version, _context) do
    with {:ok, state, _article, _binding} <- lock_state(community, ticket_id),
         {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version),
         {:ok, changed?} <- replace_assignees(state.article_id, community.id, user_ids),
         {:ok, _state} <- maybe_increment_version(state, changed?) do
      {:ok, ticket_id}
    end
  end

  @doc false
  def set_tags(community, ticket_id, tag_ids, expected_version, _context) do
    with {:ok, state, _article, _binding} <- lock_state(community, ticket_id),
         {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version),
         {:ok, changed?} <- replace_tags(state.article_id, community.id, tag_ids),
         {:ok, _state} <- maybe_increment_version(state, changed?) do
      {:ok, ticket_id}
    end
  end

  @doc false
  def set_facets(community, ticket_id, facets, expected_version, _context) do
    with {:ok, state, _article, _binding} <- lock_state(community, ticket_id),
         {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version),
         {:ok, changed?} <- replace_facets(state.article_id, facets),
         {:ok, _state} <- maybe_increment_version(state, changed?) do
      {:ok, ticket_id}
    end
  end

  @doc false
  def transition(community, ticket_id, status, expected_version, context) do
    with {:ok, state, _article, binding} <- lock_state(community, ticket_id),
         {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version),
         {:ok, :pass} <- Lifecycle.validate_transition(state, status),
         from_status = state.status,
         {:ok, state} <- Lifecycle.update_status(state, status),
         {:ok, activity} <-
           insert_status_event(
             ticket_id,
             from_status,
             state.status,
             context.actor,
             context.command_id
           ),
         {:ok, _notification} <-
           Notifications.enqueue_activity(community, state, activity, context.command_id),
         {:ok, _cache} <-
           invalidate_user_ticket_cache(
             community,
             state,
             binding,
             context.command_id,
             "ticket_status"
           ) do
      {:ok, ticket_id}
    end
  end

  @doc false
  def move(community, ticket_id, status, rank, expected_version, context) do
    with {:ok, state, _article, binding} <- lock_state(community, ticket_id),
         {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version),
         true <- is_integer(rank) and rank >= 0,
         target_status = status || state.status,
         {:ok, :pass} <- Lifecycle.validate_same_or_transition(state, target_status),
         from_status = state.status,
         {:ok, state} <- Lifecycle.update_position(state, target_status, rank),
         {:ok, activity} <- maybe_insert_status_event(ticket_id, from_status, state, context),
         {:ok, _notification} <- enqueue_status_event(community, state, activity, context),
         {:ok, _cache} <-
           invalidate_user_ticket_cache(
             community,
             state,
             binding,
             context.command_id,
             "ticket_reordered"
           ) do
      {:ok, ticket_id}
    else
      false -> {:error, ErrorCat.invalid_ticket_content()}
      error -> error
    end
  end

  @doc false
  def update(community, ticket_id, attrs, expected_version, context) do
    with {:ok, state, _article, binding} <- lock_state(community, ticket_id),
         {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version),
         {:ok, state} <- update_ticket_fields(state, attrs),
         {:ok, _cache} <-
           invalidate_user_ticket_cache(
             community,
             state,
             binding,
             context.command_id,
             "ticket_updated"
           ) do
      {:ok, ticket_id}
    else
      nil -> {:error, ErrorCat.not_found()}
      {:error, _reason} = error -> error
      _ -> {:error, ErrorCat.invalid_ticket_content()}
    end
  end

  @doc false
  def ensure_draft(community, ticket_id, expected_lifecycle_version, context) do
    with {:ok, state, article, _binding} <- lock_state(community, ticket_id),
         true <- state.type == :user,
         {:ok, lifecycle} <- lock_ticket_lifecycle(article),
         true <- lifecycle.version == expected_lifecycle_version,
         {:ok, author} <- Persist.ensure_author_exists(context.actor),
         {:ok, _draft} <-
           CMS.Tickets.Content.ensure_workspace(article, author,
             expected_lifecycle_version: expected_lifecycle_version
           ) do
      {:ok, ticket_id}
    else
      false -> {:error, ErrorCat.version_conflict()}
      error -> error
    end
  end

  @doc false
  def save_draft(
        community,
        ticket_id,
        attrs,
        expected_draft_version,
        expected_lifecycle_version,
        context
      ) do
    with {:ok, _state, article, _binding} <- lock_state(community, ticket_id),
         {:ok, lifecycle} <- lock_ticket_lifecycle(article),
         true <- lifecycle.version == expected_lifecycle_version,
         {:ok, draft} <- CMS.Tickets.Content.get_workspace(article),
         true <- draft.version == expected_draft_version,
         {:ok, author} <- Persist.ensure_author_exists(context.actor),
         {:ok, changed_attrs} <- changed_content_attrs(article, draft, attrs),
         {:ok, _saved_draft} <-
           maybe_save_ticket_draft(article, changed_attrs, author, lifecycle, draft) do
      {:ok, ticket_id}
    else
      false -> {:error, ErrorCat.version_conflict()}
      error -> error
    end
  end

  @doc false
  def publish(
        community,
        ticket_id,
        reason,
        expected_draft_version,
        expected_lifecycle_version,
        expected_workflow_version,
        expected_preview,
        context
      ) do
    with {:ok, :pass} <- lock_ticket_source_posts(ticket_id),
         {:ok, state, article, binding} <- lock_state(community, ticket_id),
         true <- state.type == :user,
         {:ok, :pass} <- Lifecycle.ensure_version(state, expected_workflow_version),
         {:ok, lifecycle} <- lock_ticket_lifecycle(article),
         true <- lifecycle.version == expected_lifecycle_version,
         {:ok, draft} <- CMS.Tickets.Content.get_workspace(article),
         true <- draft.version == expected_draft_version,
         true <- public_ticket_publish_allowed?(community.id, ticket_id),
         true <-
           expected_preview == CMS.Tickets.Publication.preview_anchor(community.id, ticket_id),
         {:ok, result} <-
           record_visibility_change(
             community,
             state,
             article,
             binding,
             :published,
             reason,
             context
           ) do
      {:ok, result}
    else
      false -> {:error, ErrorCat.version_conflict()}
      error -> error
    end
  end

  @doc false
  def move_to_draft(community, ticket_id, reason, expected_lifecycle_version, context) do
    with {:ok, state, article, binding} <- lock_state(community, ticket_id),
         true <- state.type == :user,
         {:ok, lifecycle} <- lock_ticket_lifecycle(article),
         true <- lifecycle.version == expected_lifecycle_version do
      case lifecycle.state do
        :draft ->
          {:ok, ticket_id}

        :published ->
          record_visibility_change(
            community,
            state,
            article,
            binding,
            :draft,
            reason,
            context
          )

        _ ->
          {:error, ErrorCat.invalid_visibility_transition()}
      end
    else
      false -> {:error, ErrorCat.version_conflict()}
      error -> error
    end
  end

  @doc false
  def add_update(
        community,
        ticket_id,
        body,
        visibility,
        supersedes_id,
        expected_lifecycle_version,
        expected_version,
        context
      ) do
    with {:ok, state, article, binding} <- lock_state(community, ticket_id),
         {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version),
         {:ok, visibility} <- update_visibility_value(visibility, state),
         {:ok, :pass} <- ensure_update_lifecycle(visibility, article, expected_lifecycle_version),
         {:ok, supersedes_id} <- validate_supersedes(ticket_id, visibility, supersedes_id),
         {:ok, update} <-
           insert_update(ticket_id, body, visibility, supersedes_id, context.actor),
         {:ok, _activity} <- insert_update_activity(article, update, context),
         {:ok, state} <- Lifecycle.increment_version(state),
         {:ok, _notification} <-
           Notifications.enqueue_update(community, state, update, context.command_id),
         {:ok, _cache} <-
           (if visibility == :public do
              invalidate_user_ticket_cache(
                community,
                state,
                binding,
                context.command_id,
                "ticket_public_update"
              )
            else
              {:ok, :pass}
            end) do
      {:ok, ticket_id}
    end
  end

  @doc false
  def link_source(community, ticket_id, :post, post_id, expected_version, context) do
    with {:ok, post, _public, _revision, post_binding} <- lock_public_post(community, post_id),
         {:ok, state, _article, binding} <- lock_state(community, ticket_id),
         {:ok, :pass} <- ensure_linkable(state),
         {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version) do
      case Repo.get_by(TicketSource,
             ticket_id: ticket_id,
             type: :post,
             post_id: post.id
           ) do
        %TicketSource{} ->
          {:ok, ticket_id}

        nil ->
          with {:ok, link} <- insert_post_link(%Article{id: ticket_id}, post),
               {:ok, state} <- Lifecycle.increment_version(state),
               {:ok, _activity} <-
                 log_ticket_activity(
                   Repo.get!(Article, ticket_id),
                   :source_linked,
                   context.actor,
                   context.command_id,
                   metadata: %{
                     ticket_source_id: link.id,
                     source_type: "post",
                     source_id: post.id
                   }
                 ),
               {:ok, _cache} <-
                 invalidate_user_ticket_cache(
                   community,
                   state,
                   binding,
                   context.command_id,
                   "ticket_source_linked",
                   [post_binding.inner_id]
                 ) do
            {:ok, ticket_id}
          end
      end
    else
      error -> error
    end
  end

  @doc false
  def unlink_source(community, ticket_id, source_id, expected_version, context) do
    case Repo.get_by(TicketSource, id: source_id, ticket_id: ticket_id, type: :post) do
      nil ->
        with {:ok, state, _article, _binding} <- lock_state(community, ticket_id),
             true <- state.type == :user,
             {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version) do
          {:ok, ticket_id}
        else
          false -> {:error, ErrorCat.invalid_ticket_type()}
          error -> error
        end

      %TicketSource{post_id: post_id} = source ->
        with {:ok, _post, post_binding} <- lock_post_source(community, post_id),
             {:ok, state, article, binding} <- lock_state(community, ticket_id),
             true <- state.type == :user,
             {:ok, :pass} <- Lifecycle.ensure_version(state, expected_version),
             %TicketSource{} = link <- lock_source(source.id, ticket_id) do
          with {:ok, :pass} <-
                 unlink_source_in_transaction(
                   community,
                   state,
                   article,
                   binding,
                   link,
                   post_binding.inner_id,
                   context.actor,
                   context.command_id,
                   "ticket_source_unlinked"
                 ) do
            {:ok, ticket_id}
          end
        else
          false -> {:error, ErrorCat.invalid_ticket_type()}
          nil -> {:error, ErrorCat.not_found()}
          error -> error
        end
    end
  end

  defp record_visibility_change(
         community,
         state,
         article,
         binding,
         target_lifecycle_state,
         reason,
         context
       ) do
    with {:ok, lifecycle} <- lock_ticket_lifecycle(article),
         {:ok, lifecycle, revision} <-
           prepare_visibility_content(article, lifecycle, target_lifecycle_state, context.actor),
         {:ok, updated_lifecycle} <-
           CMS.Articles.Lifecycle.transition(lifecycle, target_lifecycle_state),
         {:ok, updated_state} <- Lifecycle.increment_version(state),
         {:ok, updated_binding} <- ensure_ticket_number(binding, target_lifecycle_state),
         {:ok, _public} <-
           maybe_select_ticket_public(article, revision, target_lifecycle_state, context.actor),
         {:ok, _mention_intent} <-
           record_mention_visibility(article, target_lifecycle_state, context.command_id),
         {:ok, :pass} <- GraphRevision.bump_for_article(article.id),
         {:ok, activity} <-
           log_ticket_activity(
             article,
             if(target_lifecycle_state == :published, do: :published, else: :moved_to_draft),
             context.actor,
             context.command_id,
             metadata: %{
               lifecycle_version: updated_lifecycle.version,
               reason: reason,
               from_publication_state: Atom.to_string(lifecycle.state),
               to_publication_state: Atom.to_string(target_lifecycle_state)
             },
             payload: visibility_payload(revision)
           ),
         {:ok, _notification} <-
           (if target_lifecycle_state == :published do
              Notifications.enqueue_activity(
                community,
                updated_state,
                activity,
                context.command_id
              )
            else
              {:ok, :pass}
            end),
         {:ok, _cache} <-
           invalidate_user_ticket_cache(
             community,
             updated_state,
             updated_binding,
             context.command_id,
             "ticket_visibility"
           ) do
      {:ok, article.id}
    else
      nil -> {:error, ErrorCat.not_found()}
      {:error, _reason} = error -> error
    end
  end

  defp prepare_visibility_content(
         article,
         %ArticleLifecycle{state: :published} = lifecycle,
         :draft,
         actor
       ) do
    with {:ok, author} <- Persist.ensure_author_exists(actor),
         {:ok, _draft} <-
           CMS.Tickets.Content.ensure_workspace(article, author,
             expected_lifecycle_version: lifecycle.version
           ) do
      {:ok, lifecycle, nil}
    end
  end

  defp prepare_visibility_content(
         _article,
         %ArticleLifecycle{state: :draft} = lifecycle,
         :draft,
         _actor
       ) do
    {:ok, lifecycle, nil}
  end

  defp prepare_visibility_content(
         article,
         %ArticleLifecycle{state: :draft} = lifecycle,
         :published,
         _actor
       ) do
    with {:ok, draft} <- CMS.Tickets.Content.get_workspace(article),
         {:ok, revision} <- CMS.Tickets.Content.create_revision(article, draft) do
      {:ok, lifecycle, {revision, draft}}
    end
  end

  defp prepare_visibility_content(
         article,
         %ArticleLifecycle{state: :published} = lifecycle,
         :published,
         _actor
       ) do
    with {:ok, draft} <- CMS.Tickets.Content.get_workspace(article),
         {:ok, revision} <- CMS.Tickets.Content.create_revision(article, draft) do
      {:ok, lifecycle, {revision, draft}}
    end
  end

  defp prepare_visibility_content(_article, _lifecycle, _target, _actor) do
    {:error, ErrorCat.invalid_visibility_transition()}
  end

  defp maybe_select_ticket_public(_article, nil, :draft, _actor), do: {:ok, :pass}

  defp maybe_select_ticket_public(
         article,
         {%ArticleRevision{} = revision, %CMS.Model.ArticleDraft{} = draft},
         :published,
         actor
       ) do
    with {:ok, author} <- Persist.ensure_author_exists(actor),
         {:ok, _public} <- CMS.Tickets.Content.select_public(article, revision, author),
         {:ok, :pass} <- CMS.Tickets.Content.delete_workspace(article, draft) do
      {:ok, :pass}
    end
  end

  defp record_mention_visibility(_article, :draft, _command_id), do: {:ok, :pass}

  defp record_mention_visibility(%Article{} = article, :published, command_id) do
    case Repo.get(ArticlePublic, article.id) do
      %ArticlePublic{} = public ->
        token = "#{public.revision_id}:#{public.publication_version}"

        with {:ok, _state} <- SyncProgress.mark_pending_in_transaction(article, token) do
          CMS.Articles.Effects.enqueue(
            "article.mention_sync",
            "article",
            article.id,
            {:command, command_id},
            %{source_type: "ticket", content_token: token},
            effect_key: "article.mention_sync:ticket:#{article.id}:#{token}",
            retry_failed: true
          )
        end

      nil ->
        {:error, :ticket_publication_missing}
    end
  end

  defp ensure_ticket_number(%ArticleBinding{inner_id: inner_id} = binding, :published)
       when is_integer(inner_id) do
    {:ok, binding}
  end

  defp ensure_ticket_number(%ArticleBinding{} = binding, :published) do
    Numbering.assign_binding_inner_id(binding)
  end

  defp ensure_ticket_number(%ArticleBinding{} = binding, :draft), do: {:ok, binding}

  defp visibility_payload({%ArticleRevision{id: revision_id}, _draft}) do
    %{revision_id: revision_id}
  end

  defp visibility_payload(_revision), do: %{}

  defp lock_ticket_lifecycle(%Article{id: article_id}) do
    case Repo.one(
           from(lifecycle in ArticleLifecycle,
             where: lifecycle.article_id == ^article_id and lifecycle.thread == :ticket,
             lock: "FOR UPDATE"
           )
         ) do
      %ArticleLifecycle{} = lifecycle -> {:ok, lifecycle}
      nil -> {:error, ErrorCat.not_found()}
    end
  end

  defp lock_ticket_source_posts(ticket_id) do
    post_ids =
      from(link in TicketSource,
        where: link.ticket_id == ^ticket_id and link.type == :post,
        order_by: [asc: link.post_id],
        select: link.post_id
      )
      |> Repo.all()

    _locked_posts =
      from(article in Article,
        join: lifecycle in ArticleLifecycle,
        on: lifecycle.article_id == article.id and lifecycle.thread == :post,
        where: article.id in ^post_ids,
        order_by: [asc: article.id],
        lock: "FOR UPDATE"
      )
      |> Repo.all()

    _locked_blocks =
      from(block in ArticleReviewBlock,
        where: block.article_id in ^post_ids and is_nil(block.resolved_at),
        order_by: [asc: block.article_id, asc: block.id],
        lock: "FOR UPDATE"
      )
      |> Repo.all()

    {:ok, :pass}
  end

  defp lock_public_post(community, post_id) do
    with {:ok, _post, _binding} <- lock_post_source(community, post_id),
         {:ok, post, public, revision, binding} <-
           CMS.Tickets.Query.source_post(community, post_id) do
      {:ok, post, public, revision, binding}
    end
  end

  defp lock_post_source(community, post_id) do
    {:ok, :pass} = CMS.Articles.MutationLock.lock_community_admission(post_id)

    article =
      from(article in Article,
        where: article.id == ^post_id and article.thread == :post,
        lock: "FOR UPDATE"
      )
      |> Repo.one()

    lifecycle =
      from(lifecycle in ArticleLifecycle,
        where: lifecycle.article_id == ^post_id and lifecycle.thread == :post,
        lock: "FOR UPDATE"
      )
      |> Repo.one()

    _active_blocks =
      from(block in ArticleReviewBlock,
        where: block.article_id == ^post_id and is_nil(block.resolved_at),
        order_by: [asc: block.id],
        lock: "FOR UPDATE"
      )
      |> Repo.all()

    binding =
      from(binding in ArticleBinding,
        where: binding.article_id == ^post_id and binding.community_id == ^community.id,
        lock: "FOR UPDATE"
      )
      |> Repo.one()

    case {article, lifecycle, binding} do
      {%Article{thread: :post} = article, %ArticleLifecycle{}, %ArticleBinding{} = binding} ->
        {:ok, article, binding}

      _ ->
        {:error, ErrorCat.post_not_public()}
    end
  end

  defp lock_source(source_id, ticket_id) do
    Repo.one(
      from(link in TicketSource,
        where: link.id == ^source_id and link.ticket_id == ^ticket_id and link.type == :post,
        lock: "FOR UPDATE"
      )
    )
  end

  defp lock_ticket(community, ticket_id, type) do
    with {:ok, state, article, _binding} <- lock_state(community, ticket_id),
         true <- state.type == type do
      {:ok, article, nil}
    else
      false -> {:error, ErrorCat.invalid_ticket_type()}
      _ -> {:error, ErrorCat.not_found()}
    end
  end

  defp lock_state(community, ticket_id) do
    query =
      from(state in TicketState,
        as: :ticket_state,
        join: article in Article,
        on: article.id == state.article_id and article.thread == :ticket,
        join: binding in ArticleBinding,
        on: binding.id == state.article_binding_id and binding.community_id == ^community.id,
        where: state.article_id == ^ticket_id,
        lock: "FOR UPDATE",
        select: {state, article, binding}
      )

    case Repo.one(query) do
      {%TicketState{} = state, %Article{} = article, %ArticleBinding{} = binding} ->
        {:ok, state, article, binding}

      nil ->
        {:error, ErrorCat.not_found()}
    end
  end

  defp ticket_content_for_clone(%Article{} = article) do
    case CMS.Tickets.Content.get_workspace(article) do
      {:ok, draft} ->
        with %ArticleBodyDraft{} = body <- Repo.get(ArticleBodyDraft, draft.body_draft_id),
             {:ok, body_bag} <- BodyBag.from_document(body) do
          {:ok,
           %{title: draft.title, digest: draft.digest, body_bag: body_bag, source_draft: draft}}
        else
          nil -> {:error, ErrorCat.invalid_ticket_content()}
          {:error, reason} -> {:error, reason}
        end

      {:error, :not_found} ->
        with {:ok, revision} <- CMS.Tickets.Content.get_public_revision(article),
             %ArticleBodySnapshot{} = body <-
               Repo.get(ArticleBodySnapshot, revision.body_snapshot_id),
             {:ok, body_bag} <- BodyBag.from_document(body) do
          {:ok,
           %{
             title: revision.title,
             digest: revision.digest,
             body_bag: body_bag,
             source_revision: revision
           }}
        else
          nil -> {:error, ErrorCat.invalid_ticket_content()}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp clone_parent_ticket_refs(parent, %{source_draft: source_draft}, target, target_draft) do
    CMS.Tickets.Content.clone_ticket_draft_refs(parent, source_draft, target, target_draft)
  end

  defp clone_parent_ticket_refs(parent, %{source_revision: revision}, target, target_draft) do
    CMS.Tickets.Content.clone_revision_refs(parent, revision, target, target_draft)
  end

  defp ticket_body_bag(attrs) do
    input = value(attrs, :body_bag)

    cond do
      is_map(input) ->
        BodyBag.cast(input, thread: :ticket)

      is_binary(value(attrs, :body)) ->
        case Jason.decode(value(attrs, :body)) do
          {:ok, decoded} when is_map(decoded) -> BodyBag.cast(decoded, thread: :ticket)
          _ -> BodyBag.cast(BodyBag.empty_doc(), thread: :ticket)
        end

      true ->
        BodyBag.cast(BodyBag.empty_doc(), thread: :ticket)
    end
  end

  defp required_title(attrs) do
    case value(attrs, :title) do
      title when is_binary(title) ->
        case String.trim(title) do
          "" -> {:error, ErrorCat.invalid_ticket_content()}
          title -> {:ok, title}
        end

      _ ->
        {:error, ErrorCat.invalid_ticket_content()}
    end
  end

  defp changed_content_attrs(%CMS.Model.ArticleDraft{} = draft, attrs) do
    Enum.reduce_while([:title, :digest], {:ok, %{}}, fn field, {:ok, changed} ->
      if has_attr?(attrs, field) do
        normalized = normalize_content_field(field, value(attrs, field))

        case normalized do
          {:ok, value} ->
            if value == Map.get(draft, field) do
              {:cont, {:ok, changed}}
            else
              {:cont, {:ok, Map.put(changed, field, value)}}
            end

          {:error, reason} ->
            {:halt, {:error, reason}}
        end
      else
        {:cont, {:ok, changed}}
      end
    end)
  end

  defp normalize_content_field(:title, value) when is_binary(value) do
    title = String.trim(value)
    if title == "", do: {:error, ErrorCat.invalid_ticket_content()}, else: {:ok, title}
  end

  defp normalize_content_field(:digest, nil), do: {:ok, nil}

  defp normalize_content_field(:digest, value) when is_binary(value) do
    case String.trim(value) do
      "" -> {:ok, nil}
      digest -> {:ok, digest}
    end
  end

  defp normalize_content_field(_field, _value), do: {:error, ErrorCat.invalid_ticket_content()}

  defp maybe_save_ticket_draft(_article, attrs, _author, _lifecycle, draft)
       when map_size(attrs) == 0 do
    {:ok, draft}
  end

  defp maybe_save_ticket_draft(article, attrs, author, lifecycle, draft) do
    CMS.Tickets.Content.save_workspace(article, attrs, author,
      expected_lifecycle_version: lifecycle.version,
      expected_version: draft.version
    )
  end

  defp changed_content_attrs(article, draft, attrs) do
    with {:ok, fields} <- changed_content_attrs(draft, attrs),
         {:ok, fields} <- changed_body_attrs(article, draft, attrs, fields) do
      {:ok, fields}
    end
  end

  defp changed_body_attrs(article, draft, attrs, fields) do
    case value(attrs, :body_bag) do
      nil ->
        {:ok, fields}

      input ->
        with {:ok, body_bag} <- BodyBag.cast(input, thread: article.thread),
             %ArticleBodyDraft{} = current <- Repo.get(ArticleBodyDraft, draft.body_draft_id) do
          next = BodyBag.to_document_attrs(body_bag)

          if next.body_hash == current.body_hash do
            {:ok, fields}
          else
            {:ok, Map.put(fields, :body_bag, input)}
          end
        else
          nil -> {:error, ErrorCat.invalid_ticket_content()}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp update_ticket_fields(state, attrs) do
    changes = %{workflow_version: state.workflow_version + 1}

    changes =
      Enum.reduce([:priority, :planned_start_at, :planned_end_at], changes, fn field, acc ->
        if has_attr?(attrs, field), do: Map.put(acc, field, value(attrs, field)), else: acc
      end)

    state
    |> TicketState.changeset(changes)
    |> Repo.update()
  end

  defp insert_update(ticket_id, body, visibility, supersedes_id, actor) do
    body = String.trim(body)

    if body == "" do
      {:error, ErrorCat.invalid_ticket_content()}
    else
      published_at = if visibility == :public, do: DateTime.utc_now(:second), else: nil

      %TicketUpdate{}
      |> TicketUpdate.changeset(%{
        ticket_id: ticket_id,
        body: body,
        visibility: visibility,
        author_id: actor.id,
        published_at: published_at,
        supersedes_id: supersedes_id
      })
      |> Repo.insert()
    end
  end

  defp validate_supersedes(_ticket_id, _visibility, nil), do: {:ok, nil}

  defp validate_supersedes(ticket_id, :public, supersedes_id) when is_binary(supersedes_id) do
    case Ecto.UUID.cast(supersedes_id) do
      {:ok, supersedes_id} ->
        current_public_update =
          from(update in TicketUpdate,
            left_join: replacement in TicketUpdate,
            on: replacement.supersedes_id == update.id,
            where:
              update.id == ^supersedes_id and update.ticket_id == ^ticket_id and
                update.visibility == :public and is_nil(replacement.id)
          )

        if Repo.exists?(current_public_update) do
          {:ok, supersedes_id}
        else
          {:error, ErrorCat.invalid_ticket_content()}
        end

      :error ->
        {:error, ErrorCat.invalid_ticket_content()}
    end
  end

  defp validate_supersedes(_ticket_id, _visibility, _supersedes_id) do
    {:error, ErrorCat.invalid_ticket_content()}
  end

  defp update_visibility_value(:public, %TicketState{type: :user}), do: {:ok, :public}

  defp update_visibility_value(:public, %TicketState{}) do
    {:error, ErrorCat.invalid_ticket_type()}
  end

  defp update_visibility_value(:internal, _state), do: {:ok, :internal}

  defp update_visibility_value(_visibility, _state) do
    {:error, ErrorCat.invalid_ticket_content()}
  end

  defp ensure_update_lifecycle(:internal, _article, _expected_lifecycle_version) do
    {:ok, :pass}
  end

  defp ensure_update_lifecycle(:public, %Article{} = article, expected_lifecycle_version)
       when is_integer(expected_lifecycle_version) do
    with {:ok, lifecycle} <- lock_ticket_lifecycle(article),
         true <- lifecycle.version == expected_lifecycle_version do
      if lifecycle.state == :published and
           not Repo.exists?(
             from(block in ArticleReviewBlock,
               where: block.article_id == ^article.id and is_nil(block.resolved_at)
             )
           ) do
        {:ok, :pass}
      else
        {:error, ErrorCat.ticket_is_held()}
      end
    else
      false -> {:error, ErrorCat.version_conflict()}
      {:error, reason} -> {:error, reason}
    end
  end

  defp ensure_update_lifecycle(:public, _article, _expected_lifecycle_version) do
    {:error, ErrorCat.version_conflict()}
  end

  defp insert_state(article, binding, type, status) do
    %TicketState{}
    |> TicketState.changeset(%{
      article_id: article.id,
      article_binding_id: binding.id,
      type: type,
      status: status,
      priority: 1,
      rank: 0,
      workflow_version: 1
    })
    |> Repo.insert()
  end

  defp insert_post_link(ticket, post) do
    %TicketSource{}
    |> TicketSource.changeset(%{ticket_id: ticket.id, type: :post, post_id: post.id})
    |> Repo.insert()
  end

  defp insert_worker(parent_id, worker_id) do
    %TicketWorker{}
    |> TicketWorker.changeset(%{parent_ticket_id: parent_id, worker_ticket_id: worker_id})
    |> Repo.insert()
  end

  defp insert_case_member(case_id, ticket_id) do
    case Repo.get_by(TicketCaseMember, case_ticket_id: case_id, user_ticket_id: ticket_id) do
      %TicketCaseMember{} = member ->
        {:ok, member, false}

      nil ->
        case %TicketCaseMember{}
             |> TicketCaseMember.changeset(%{case_ticket_id: case_id, user_ticket_id: ticket_id})
             |> Repo.insert() do
          {:ok, member} -> {:ok, member, true}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp insert_case_worker(case_id, worker_id) do
    case Repo.get_by(TicketCaseWorker,
           case_ticket_id: case_id,
           worker_ticket_id: worker_id
         ) do
      %TicketCaseWorker{} = relation ->
        {:ok, relation, false}

      nil ->
        case %TicketCaseWorker{}
             |> TicketCaseWorker.changeset(%{
               case_ticket_id: case_id,
               worker_ticket_id: worker_id
             })
             |> Repo.insert() do
          {:ok, relation} -> {:ok, relation, true}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp replace_assignees(ticket_id, community_id, user_ids) do
    user_ids = Enum.uniq(user_ids)

    if Enum.any?(user_ids, &(not is_integer(&1) or &1 <= 0)) do
      {:error, ErrorCat.assignee_not_member()}
    else
      eligible_count =
        Repo.aggregate(
          from(member in CommunityModerator,
            where: member.community_id == ^community_id and member.user_id in ^user_ids
          ),
          :count
        )

      current_ids =
        from(assignee in TicketAssignee,
          where: assignee.ticket_id == ^ticket_id,
          select: assignee.user_id,
          order_by: [asc: assignee.user_id]
        )
        |> Repo.all()

      next_ids = Enum.sort(user_ids)

      cond do
        eligible_count != length(next_ids) ->
          {:error, ErrorCat.assignee_not_member()}

        current_ids == next_ids ->
          {:ok, false}

        true ->
          Repo.delete_all(
            from(assignee in TicketAssignee, where: assignee.ticket_id == ^ticket_id)
          )

          Enum.reduce_while(next_ids, {:ok, :pass}, fn user_id, {:ok, _} ->
            case %TicketAssignee{}
                 |> TicketAssignee.changeset(%{ticket_id: ticket_id, user_id: user_id})
                 |> Repo.insert() do
              {:ok, _assignee} -> {:cont, {:ok, :pass}}
              {:error, reason} -> {:halt, {:error, reason}}
            end
          end)
          |> case do
            {:ok, :pass} -> {:ok, true}
            {:error, reason} -> {:error, reason}
          end
      end
    end
  end

  defp replace_tags(ticket_id, community_id, tag_ids) do
    if Enum.any?(tag_ids, &(not is_integer(&1) or &1 <= 0)) do
      {:error, ErrorCat.invalid_ticket_content()}
    else
      next_ids = Enum.uniq(tag_ids) |> Enum.sort()

      valid_count =
        Repo.aggregate(
          from(tag in CommunityTag,
            where:
              tag.id in ^next_ids and tag.community_id == ^community_id and tag.thread == :post
          ),
          :count
        )

      current_ids =
        from(tag in TicketTag,
          where: tag.ticket_id == ^ticket_id,
          select: tag.community_tag_id,
          order_by: [asc: tag.community_tag_id]
        )
        |> Repo.all()

      cond do
        valid_count != length(next_ids) ->
          {:error, ErrorCat.invalid_ticket_content()}

        current_ids == next_ids ->
          {:ok, false}

        true ->
          Repo.delete_all(from(tag in TicketTag, where: tag.ticket_id == ^ticket_id))

          Enum.reduce_while(next_ids, {:ok, :pass}, fn tag_id, {:ok, _} ->
            case %TicketTag{}
                 |> TicketTag.changeset(%{ticket_id: ticket_id, community_tag_id: tag_id})
                 |> Repo.insert() do
              {:ok, _tag} -> {:cont, {:ok, :pass}}
              {:error, reason} -> {:halt, {:error, reason}}
            end
          end)
          |> case do
            {:ok, :pass} -> {:ok, true}
            {:error, reason} -> {:error, reason}
          end
      end
    end
  end

  defp replace_facets(ticket_id, facets) do
    with {:ok, next_values} <- normalize_facets(facets) do
      current_values =
        from(facet in TicketFacet,
          where: facet.ticket_id == ^ticket_id,
          select: {facet.key, facet.value},
          order_by: [asc: facet.key, asc: facet.value]
        )
        |> Repo.all()

      if current_values == next_values do
        {:ok, false}
      else
        Repo.delete_all(from(facet in TicketFacet, where: facet.ticket_id == ^ticket_id))

        Enum.reduce_while(next_values, {:ok, :pass}, fn {key, value}, {:ok, _} ->
          case %TicketFacet{}
               |> TicketFacet.changeset(%{ticket_id: ticket_id, key: key, value: value})
               |> Repo.insert() do
            {:ok, _facet} -> {:cont, {:ok, :pass}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)
        |> case do
          {:ok, :pass} -> {:ok, true}
          {:error, reason} -> {:error, reason}
        end
      end
    end
  end

  defp normalize_facets(facets) do
    values =
      Enum.map(facets, fn facet ->
        key = facet |> value(:key) |> to_string() |> String.trim() |> String.downcase()
        facet_value = facet |> value(:value) |> to_string() |> String.trim() |> String.downcase()
        {key, facet_value}
      end)
      |> Enum.uniq()
      |> Enum.sort()

    valid? =
      Enum.all?(values, fn {key, facet_value} ->
        key in ["version", "os", "module"] and facet_value != "" and
          String.length(facet_value) <= 160
      end)

    if valid?, do: {:ok, values}, else: {:error, ErrorCat.invalid_ticket_content()}
  end

  defp maybe_increment_version(state, true), do: Lifecycle.increment_version(state)
  defp maybe_increment_version(state, false), do: {:ok, state}

  defp case_worker_is_member_owned?(case_id, worker_id) do
    Repo.exists?(
      from(member in TicketCaseMember,
        join: worker in TicketWorker,
        on: worker.parent_ticket_id == member.user_ticket_id,
        where: member.case_ticket_id == ^case_id and worker.worker_ticket_id == ^worker_id
      )
    )
  end

  defp delete_case_worker_refs(case_id, user_ticket_id) do
    {deleted_count, _} =
      Repo.delete_all(
        from(relation in TicketCaseWorker,
          join: worker in TicketWorker,
          on: worker.worker_ticket_id == relation.worker_ticket_id,
          where:
            relation.case_ticket_id == ^case_id and worker.parent_ticket_id == ^user_ticket_id
        )
      )

    {:ok, deleted_count}
  end

  defp invalidate_user_ticket_cache(
         community,
         state,
         binding,
         command_id,
         effect_key,
         additional_post_ids \\ []
       )

  defp invalidate_user_ticket_cache(
         community,
         %TicketState{type: :user} = state,
         %ArticleBinding{} = binding,
         command_id,
         effect_key,
         additional_post_ids
       ) do
    case binding.inner_id do
      inner_id when is_integer(inner_id) ->
        post_inner_ids =
          from(link in TicketSource,
            join: post_binding in ArticleBinding,
            on:
              post_binding.article_id == link.post_id and
                post_binding.community_id == ^community.id,
            where: link.ticket_id == ^state.article_id,
            select: post_binding.inner_id
          )
          |> Repo.all()
          |> Enum.reject(&is_nil/1)

        CMS.Tickets.Cache.enqueue(
          community,
          state.article_id,
          inner_id,
          Enum.uniq(post_inner_ids ++ additional_post_ids),
          command_id,
          effect_key
        )

      _ ->
        {:ok, :pass}
    end
  end

  defp invalidate_user_ticket_cache(_community, _state, _binding, _command_id, _effect_key, _ids) do
    {:ok, :pass}
  end

  defp all_linked_posts_public?(community_id, ticket_id) do
    case PublicPosts.ids_query(community_id) do
      {:ok, public_post_ids} ->
        visible_post =
          from(link in TicketSource,
            where: link.ticket_id == ^ticket_id and link.post_id in subquery(public_post_ids),
            select: 1
          )

        Repo.exists?(visible_post)

      {:error, _reason} ->
        false
    end
  end

  defp public_ticket_publish_allowed?(community_id, ticket_id) do
    all_linked_posts_public?(community_id, ticket_id) and
      not Repo.exists?(
        from(block in ArticleReviewBlock,
          where: block.article_id == ^ticket_id and is_nil(block.resolved_at)
        )
      )
  end

  defp ensure_linkable(%TicketState{type: :user}), do: {:ok, :pass}
  defp ensure_linkable(_state), do: {:error, ErrorCat.invalid_ticket_type()}

  defp maybe_insert_status_event(_ticket_id, from_status, %{status: from_status}, _context) do
    {:ok, :pass}
  end

  defp maybe_insert_status_event(ticket_id, from_status, state, context) do
    insert_status_event(ticket_id, from_status, state.status, context.actor, context.command_id)
  end

  defp enqueue_status_event(community, state, %TicketLog{} = activity, context) do
    Notifications.enqueue_activity(community, state, activity, context.command_id)
  end

  defp enqueue_status_event(_community, _state, :pass, _context), do: {:ok, :pass}

  defp has_attr?(attrs, key) do
    Map.has_key?(attrs, key) or Map.has_key?(attrs, Atom.to_string(key))
  end

  defp attr_or_source(attrs, key, source) do
    if has_attr?(attrs, key), do: value(attrs, key), else: source
  end

  defp insert_status_event(ticket_id, from, to, actor, command_id) do
    log_ticket_activity(Repo.get!(Article, ticket_id), :work_status_changed, actor, command_id,
      payload: %{
        from_status: maybe_string(from),
        to_status: Atom.to_string(to)
      }
    )
  end

  defp insert_created_activity(article, actor, command_id) do
    log_ticket_activity(article, :created, actor, command_id)
  end

  defp insert_update_activity(article, %TicketUpdate{visibility: :public} = update, context) do
    {action, payload} =
      case update.supersedes_id do
        nil ->
          {:public_update_published, %{update_id: update.id}}

        supersedes_id ->
          {:public_update_superseded, %{update_id: update.id, supersedes_id: supersedes_id}}
      end

    log_ticket_activity(article, action, context.actor, context.command_id, payload: payload)
  end

  defp insert_update_activity(_article, %TicketUpdate{visibility: :internal}, _context) do
    {:ok, :pass}
  end

  defp log_ticket_activity(article, action, actor, command_id, opts \\ []) do
    case Repo.get_by(ArticleBinding, article_id: article.id) do
      %ArticleBinding{community_id: community_id} ->
        resource = article |> Map.from_struct() |> Map.put(:community_id, community_id)

        Activity.log(resource, action,
          actor: actor || :system,
          source: :api,
          operation_ref: command_id,
          payload: Keyword.get(opts, :payload, %{}),
          metadata: Keyword.get(opts, :metadata, %{}),
          changed_fields: Keyword.get(opts, :changed_fields, [])
        )

      nil ->
        {:error, ErrorCat.not_found()}
    end
  end

  defp maybe_string(nil), do: nil
  defp maybe_string(value) when is_atom(value), do: Atom.to_string(value)

  defp value(attrs, key) do
    Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))
  end
end
