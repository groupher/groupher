defmodule GroupherServer.CMS.Tickets.Effects.Notifications do
  @moduledoc """
  Queues public User Ticket notifications for linked Post authors and public
  comment participants.

  Ticket state and progress facts remain the source of truth. This adapter
  places one durable intent in the CMS Outbox and uses a source/recipient key
  when writing each existing Messaging inbox notification.

      public Ticket event
        -> durable Ticket Outbox intent
        -> linked Post authors and public comment participants
        -> Messaging inbox notification
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, Activity, CMS, Messaging, Repo}
  alias Accounts.Model.User
  alias CMS.Gate.Context.Scope.Comment, as: CommentContext
  alias CMS.Model.Comment

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    ArticlePublic,
    ArticleReviewBlock,
    ArticleRevision,
    Author,
    TicketState,
    TicketUpdate
  }

  alias Activity.Model.TicketLog

  alias CMS.Tickets.{PublicPosts, Model.Source}

  @doc "Enqueues an eligible public Ticket Activity in the caller transaction."
  def enqueue_activity(_community, state, %TicketLog{} = activity, command_id) do
    cond do
      state.type != :user ->
        {:ok, :pass}

      activity.action in [:work_status_changed, :published] and
          eligible_public_ticket?(state.article_id) ->
        enqueue(state, "ticket_activity", activity.id, command_id)

      true ->
        {:ok, :pass}
    end
  end

  def enqueue_activity(_community, _state, _activity, _command_id), do: {:ok, :pass}

  @doc "Enqueues a public User Ticket update in the caller transaction."
  def enqueue_update(_community, state, %TicketUpdate{visibility: :public} = update, command_id) do
    if state.type == :user and eligible_public_ticket?(state.article_id) do
      enqueue(state, "ticket_update", update.id, command_id)
    else
      {:ok, :pass}
    end
  end

  def enqueue_update(_community, _state, _update, _command_id), do: {:ok, :pass}

  @doc "Delivers one Outbox notification intent with per-recipient idempotency."
  def deliver(%{event: "ticket.notification", data: data}) do
    with {:ok, source_type} <- Map.fetch(data, "source_type"),
         {:ok, source_id} <- Map.fetch(data, "source_id"),
         {:ok, %{community_id: community_id} = context} <-
           load_public_context(source_type, source_id),
         {:ok, recipients} <- post_participants(context.ticket_id, community_id),
         {:ok, sender} <- notification_sender(context) do
      Enum.reduce_while(recipients, {:ok, :pass}, fn recipient, {:ok, _} ->
        if recipient.id == sender.id do
          {:cont, {:ok, :pass}}
        else
          case notify_recipient(context, sender, recipient, source_id) do
            {:ok, _notification} -> {:cont, {:ok, :pass}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end
      end)
    else
      {:ok, :pass} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
      :error -> {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
    end
  end

  def deliver(_event), do: {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}

  defp enqueue(state, source_type, source_id, command_id) do
    CMS.Outbox.send(%{
      event: "ticket.notification",
      worker: GroupherServer.Jobs.CMSOutboxTicket,
      resource_type: "ticket",
      resource_id: state.article_id,
      identity: {:command, command_id},
      effect_key: "ticket_notification:#{source_id}",
      data: %{"source_type" => source_type, "source_id" => source_id}
    })
    |> case do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  defp load_public_context("ticket_activity", activity_id) do
    case Repo.get(TicketLog, activity_id) do
      %TicketLog{} = activity ->
        load_ticket_context(
          activity.article_id,
          parse_actor_id(activity.actor_ref),
          activity.id,
          activity.action
        )

      nil ->
        {:ok, :pass}
    end
  end

  defp load_public_context("ticket_update", update_id) do
    case Repo.get(TicketUpdate, update_id) do
      %TicketUpdate{visibility: :public} = update ->
        load_ticket_context(update.ticket_id, update.author_id, update.id, :ticket_update)

      _ ->
        {:ok, :pass}
    end
  end

  defp load_public_context(_source_type, _source_id) do
    {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
  end

  defp load_ticket_context(ticket_id, actor_id, source_id, event_type) do
    with %TicketState{type: :user} = state <-
           Repo.get(TicketState, ticket_id),
         %Article{} = ticket <- Repo.get(Article, ticket_id),
         %ArticleBinding{} = ticket_binding <- Repo.get(ArticleBinding, state.article_binding_id),
         %ArticleLifecycle{state: :published} <-
           Repo.get_by(ArticleLifecycle, article_id: ticket_id, thread: :ticket),
         %ArticlePublic{} = public_ticket <- Repo.get(ArticlePublic, ticket_id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public_ticket.revision_id),
         false <- active_ticket_review?(ticket_id),
         %{} = post <- first_public_post(ticket_id, ticket_binding.community_id) do
      {:ok,
       %{
         ticket_id: ticket_id,
         ticket_number: ticket_binding.inner_id,
         ticket_title: revision.title,
         post_id: post.article_id,
         community_id: ticket_binding.community_id,
         action: notification_action(event_type),
         actor_id: actor_id,
         fallback_author_id: ticket.author_id,
         source_id: source_id
       }}
    else
      nil -> {:ok, :pass}
      false -> {:ok, :pass}
      _ -> {:ok, :pass}
    end
  end

  defp eligible_public_ticket?(ticket_id) do
    case Repo.get_by(ArticleLifecycle, article_id: ticket_id, thread: :ticket) do
      %ArticleLifecycle{state: :published} -> not active_ticket_review?(ticket_id)
      _ -> false
    end
  end

  defp active_ticket_review?(ticket_id) do
    Repo.exists?(
      from(block in ArticleReviewBlock,
        where: block.article_id == ^ticket_id and is_nil(block.resolved_at)
      )
    )
  end

  defp first_public_post(ticket_id, community_id) do
    with {:ok, public_post_ids} <- PublicPosts.ids_query(community_id) do
      Repo.one(
        from(public_post in subquery(public_post_ids),
          join: link in Source,
          on: link.post_id == public_post.id,
          join: post in Article,
          on: post.id == public_post.id,
          join: binding in ArticleBinding,
          on: binding.article_id == post.id and binding.community_id == ^community_id,
          where: link.ticket_id == ^ticket_id,
          order_by: [asc: binding.inner_id, asc: post.id],
          select: %{article_id: public_post.id},
          limit: 1
        )
      )
    end
  end

  defp post_participants(ticket_id, community_id) do
    with {:ok, public_post_ids} <- PublicPosts.ids_query(community_id),
         %Ecto.Query{} = public_comments <-
           CMS.Gate.scope(
             Comment,
             nil,
             :list,
             CommentContext.for_thread(:post, community_id: community_id)
           ) do
      linked_post_ids =
        from(public_post in subquery(public_post_ids),
          join: link in Source,
          on: link.post_id == public_post.id,
          where: link.ticket_id == ^ticket_id,
          select: public_post.id
        )

      author_ids =
        from(post in Article,
          join: author in Author,
          on: author.id == post.author_id,
          where: post.id in subquery(linked_post_ids),
          select: author.user_id
        )
        |> Repo.all()

      commenter_ids =
        from(comment in public_comments,
          where: comment.article_id in subquery(linked_post_ids),
          select: comment.author_id
        )
        |> Repo.all()

      recipient_ids = Enum.uniq(author_ids ++ commenter_ids)

      users =
        from(user in User,
          where: user.id in ^recipient_ids,
          order_by: [asc: user.id]
        )
        |> Repo.all()

      {:ok, users}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
    end
  end

  defp notification_sender(%{actor_id: actor_id, fallback_author_id: author_id}) do
    actor = if actor_id, do: Repo.get(User, actor_id), else: nil

    case actor do
      %User{} = user ->
        {:ok, user}

      nil ->
        with %Author{user_id: user_id} <- Repo.get(Author, author_id),
             %User{} = user <- Repo.get(User, user_id) do
          {:ok, user}
        else
          _ -> {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
        end
    end
  end

  defp notify_recipient(context, sender, recipient, source_id) do
    Messaging.send_notification(
      %{
        action: context.action,
        thread: :post,
        article_id: context.post_id,
        title: "Ticket ##{context.ticket_number}: #{context.ticket_title}",
        user_id: recipient.id,
        delivery_key: "ticket:#{source_id}:#{recipient.id}:notification"
      },
      sender
    )
  end

  defp notification_action(:work_status), do: :ticket_status
  defp notification_action(:work_status_changed), do: :ticket_status
  defp notification_action(:published), do: :ticket_visibility
  defp notification_action(:ticket_update), do: :ticket_update

  defp parse_actor_id(actor_ref) when is_binary(actor_ref) do
    case Integer.parse(actor_ref) do
      {id, ""} -> id
      _ -> nil
    end
  end

  defp parse_actor_id(_actor_ref), do: nil
end
