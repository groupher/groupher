defmodule GroupherServer.CMS.Outbox.Workers.Interaction.Cleanup do
  @moduledoc """
  Delivers notification and search effects for changed interactions.

  Business position:

      committed interaction outbox event
        -> Interaction.Cleanup worker
        -> notification and search effects
  """

  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Model.{Article, Comment}
  alias CMS.SearchArtiments.Indexer
  alias CMS.Events
  alias Helper.Later

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case CMS.Outbox.execute(event_id, &cleanup/1) do
      {:ok, _value} ->
        {:ok, :pass}

      {:busy, seconds} ->
        {:snooze, seconds}

      {:error, _reason} when job.attempt >= job.max_attempts ->
        _ = CMS.Outbox.mark_dead(event_id)
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp cleanup(event) do
    with {:ok, target} <- load_target(event.resource_type, event.resource_id),
         {:ok, actor} <- load_actor(event.data["actor_id"]),
         {:ok, _} <- emit_event(event.event, target, actor, event.data),
         {:ok, _} <- maybe_sync_search(target) do
      {:ok, :delivered}
    end
  end

  defp load_target("article", id) do
    case Repo.get(Article, id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, :interaction_target_not_found}
    end
  end

  defp load_target("comment", id) do
    case Repo.get(Comment, id) do
      %Comment{} = comment -> {:ok, comment}
      nil -> {:error, :interaction_target_not_found}
    end
  end

  defp load_target(_, _), do: {:error, :interaction_target_invalid}

  defp load_actor(id) when is_integer(id) or is_binary(id) do
    case Repo.get(User, id) do
      %User{} = actor -> {:ok, actor}
      nil -> {:error, :interaction_actor_not_found}
    end
  end

  defp load_actor(_), do: {:error, :interaction_actor_invalid}

  defp emit_event("interaction.upvote_changed", target, actor, _data) do
    Later.run({Events, :emit, [:notify_upvote, %{target: target, from_user: actor}]})
    Later.run({Events, :emit, [:subscribe_community, %{target: target, user: actor}]})
    {:ok, :pass}
  end

  defp emit_event("interaction.emotion_changed", %Comment{} = target, actor, _data) do
    Later.run({Events, :emit, [:subscribe_community, %{target: target, user: actor}]})
    {:ok, :pass}
  end

  defp emit_event("interaction.collect_changed", target, actor, data) do
    operation = if data["operation"] == "add", do: :add, else: :remove
    event = if operation == :add, do: :notify_collect, else: :notify_undo_collect
    Later.run({Events, :emit, [event, %{article: target, from_user: actor}]})
    {:ok, :pass}
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
