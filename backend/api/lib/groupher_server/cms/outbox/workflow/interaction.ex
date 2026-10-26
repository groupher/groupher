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
  alias CMS.Model.{Article, Comment}
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
         {:ok, _} <- Events.emit(:subscribe_community, %{target: target, user: actor}) do
      {:ok, :pass}
    end
  end

  defp emit_event("interaction.emotion_changed", %Comment{} = target, actor, _data) do
    Events.emit(:subscribe_community, %{target: target, user: actor})
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

  defp maybe_sync_search(%Comment{}), do: {:ok, :pass}

  defp maybe_sync_search(%Article{} = article) do
    normalize_search(Indexer.enqueue_metrics(article))
  end

  defp normalize_search(:ok), do: {:ok, :pass}
  defp normalize_search({:ok, _}), do: {:ok, :pass}
  defp normalize_search({:error, reason}), do: {:error, reason}
  defp normalize_search(_), do: {:ok, :pass}
end
