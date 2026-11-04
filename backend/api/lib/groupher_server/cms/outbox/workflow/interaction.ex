defmodule GroupherServer.CMS.Outbox.Workflow.Interaction do
  @moduledoc """
  Delivers notification and search effects for changed interactions.

  Business position:

      Oban outbox job
        -> Outbox.execute lease + fencing
        -> interaction notification / search effects
        -> complete / retry / snooze / terminal failure
  """

  alias GroupherServer.{Accounts, CMS, ErrorCat, Repo}
  alias Accounts.Model.User
  alias CMS.Model.{Article, Comment, Community}
  alias CMS.Interactions.ErrorCat, as: InteractionErrorCat
  alias CMS.SearchArtiments.Indexer
  alias CMS.Events

  @doc """
  Delivers one interaction outbox event to notifications and search under a lease.

  Busy leases snooze; transient delivery errors retry; after exhaustion Outbox
  records terminal failure and the job is acknowledged.
  """
  @spec perform(Oban.Job.t()) :: Oban.Worker.result()
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case CMS.Outbox.execute(event_id, &cleanup/1,
           on_error: if(job.attempt >= job.max_attempts, do: :fail, else: :classify)
         ) do
      {:ok, _value} ->
        {:ok, :pass}

      {:busy, seconds} ->
        {:snooze, seconds}

      {:error,
       %ErrorCat.Error{
         namespace: {:cms},
         reason: :outbox_delivery_exhausted
       }} ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp cleanup(event) do
    data = Map.put_new(event.data, "delivery_key", "outbox:#{event.id}:notification")

    with {:ok, target} <- load_target(event.resource_type, event.resource_id),
         {:ok, actor} <- load_actor(data["actor_id"]),
         {:ok, _} <- emit_event(event.event, target, actor, data),
         {:ok, _} <- purge_ticket_cache(target),
         {:ok, _} <- maybe_sync_search(target) do
      {:ok, :delivered}
    end
  end

  defp load_target("article", id) do
    case Repo.get(Article, id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, InteractionErrorCat.interaction_target_not_found()}
    end
  end

  defp load_target("comment", id) do
    case Repo.get(Comment, id) do
      %Comment{} = comment -> {:ok, comment}
      nil -> {:error, InteractionErrorCat.interaction_target_not_found()}
    end
  end

  defp load_target(_, _), do: {:error, InteractionErrorCat.interaction_target_invalid()}

  defp load_actor(id) when is_integer(id) or is_binary(id) do
    case Repo.get(User, id) do
      %User{} = actor -> {:ok, actor}
      nil -> {:error, InteractionErrorCat.interaction_actor_not_found()}
    end
  end

  defp load_actor(_), do: {:error, InteractionErrorCat.interaction_actor_invalid()}

  defp emit_event("interaction.upvote_changed", target, actor, data) do
    with {:ok, _} <-
           Events.emit(:notify_upvote, %{
             target: target,
             from_user: actor,
             delivery_key: data["delivery_key"]
           }),
         {:ok, _} <- subscribe_community(target, actor, data) do
      {:ok, :pass}
    end
  end

  defp emit_event("interaction.emotion_changed", %Comment{} = target, actor, data) do
    subscribe_community(target, actor, data)
  end

  defp emit_event("interaction.collect_changed", target, actor, data) do
    operation = if data["operation"] == "add", do: :add, else: :remove
    event = if operation == :add, do: :notify_collect, else: :notify_undo_collect

    Events.emit(event, %{
      article: target,
      from_user: actor,
      delivery_key: data["delivery_key"]
    })
  end

  defp emit_event(_event, _target, _actor, _data), do: {:ok, :pass}

  # A Comment has no owning Community. Old incomplete events cannot reconstruct
  # the request location; deliver their stable notification without guessing a binding.
  defp subscribe_community(%Comment{}, actor, %{"community_id" => community_id})
       when is_integer(community_id) do
    case Repo.get(Community, community_id) do
      nil -> {:ok, :community_gone}
      community -> Events.emit(:subscribe_community, %{target: community, user: actor})
    end
  end

  defp subscribe_community(%Comment{}, _actor, _data), do: {:ok, :request_context_not_recorded}

  defp subscribe_community(target, actor, _data) do
    Events.emit(:subscribe_community, %{target: target, user: actor})
  end

  defp maybe_sync_search(%Comment{}), do: {:ok, :pass}

  defp maybe_sync_search(%Article{} = article) do
    normalize_search(Indexer.enqueue_metrics(article))
  end

  defp purge_ticket_cache(%Article{thread: :post, id: article_id}) do
    CMS.Tickets.Cache.purge_post(article_id)
  end

  defp purge_ticket_cache(_target), do: {:ok, :pass}

  defp normalize_search(:ok), do: {:ok, :pass}
  defp normalize_search({:ok, _}), do: {:ok, :pass}
  defp normalize_search({:error, reason}), do: {:error, reason}
  defp normalize_search(_), do: {:ok, :pass}
end
