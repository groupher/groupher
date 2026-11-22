defmodule GroupherServer.CMS.Interactions.Effects do
  @moduledoc """
  Owns in-transaction effects emitted by Interaction commands.

  The caller owns the surrounding
  `CMS.Command` transaction; the shared Interaction outbox worker owns
  post-commit delivery. Recovery and delivery share current target and actor checks.

      Interaction Command
        -> Interactions.Effects
        -> CMS.Outbox
        -> Interaction cleanup worker
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Interactions.{Config, ErrorCat}
  alias CMS.Model.{Article, Comment, Community}
  alias CMS.Outbox.DedupeKey

  @doc "Records one Article or Comment upvote change in the caller transaction."
  def upvote_changed(resource, actor, operation, operation_ref) do
    record("interaction.upvote_changed", resource, actor, operation, nil, operation_ref)
  end

  @doc "Records one Article or Comment emotion change in the caller transaction."
  def emotion_changed(resource, actor, operation, emotion, operation_ref) do
    vocabulary =
      case resource do
        %Article{} -> Config.emotions() -- [:upvote, :collect]
        %Comment{} -> Config.comment_emotions()
        _ -> []
      end

    if emotion in vocabulary do
      record("interaction.emotion_changed", resource, actor, operation, emotion, operation_ref)
    else
      {:error, :interaction_effect_identity_required}
    end
  end

  @doc "Records one Article collection change in the caller transaction."
  def collect_changed(%Article{} = article, actor, operation, operation_ref) do
    record("interaction.collect_changed", article, actor, operation, nil, operation_ref)
  end

  def collect_changed(_resource, _actor, _operation, _operation_ref) do
    {:error, :interaction_effect_identity_required}
  end

  defp record(event, resource, %User{id: actor_id}, operation, emotion, operation_ref)
       when is_integer(actor_id) and operation in [:add, :remove] and is_binary(operation_ref) do
    with {:ok, resource_type, resource_id, community_id} <- target(resource) do
      data = %{actor_id: actor_id, operation: operation, community_id: community_id}
      data = if is_nil(emotion), do: data, else: Map.put(data, :emotion, emotion)

      CMS.Outbox.send(%{
        event: event,
        worker: GroupherServer.Jobs.CMSOutboxInteraction,
        resource_type: resource_type,
        resource_id: resource_id,
        operation_ref: operation_ref,
        dedupe_key:
          DedupeKey.encode([
            operation_ref,
            event,
            resource_type,
            resource_id,
            actor_id,
            operation,
            emotion,
            community_id
          ]),
        data: data
      })
      |> case do
        {:ok, _event} -> {:ok, :pass}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp record(_event, _resource, _actor, _operation, _emotion, _operation_ref) do
    {:error, :interaction_effect_identity_required}
  end

  defp target(%{__struct__: Article, id: id, community: %Community{id: community_id}})
       when is_binary(id) do
    {:ok, "article", id, community_id}
  end

  defp target(%Article{id: id}) when is_binary(id), do: {:ok, "article", id, nil}

  defp target(%Comment{id: id} = comment) when is_integer(id) do
    with {:ok, community} <- CMS.Comments.RequestCommunity.resolve(comment) do
      {:ok, "comment", id, community.id}
    end
  end

  defp target(_resource), do: {:error, :interaction_effect_identity_required}

  @doc "Loads the current target and original actor before recovery or delivery."
  def delivery_context(event) do
    with {:ok, target} <- load_target(event.resource_type, event.resource_id),
         {:ok, actor} <- load_actor(event.data["actor_id"]),
         {:ok, target} <- request_context(target, event) do
      {:ok, %{target: target, actor: actor}}
    end
  end

  defp request_context(%Article{} = article, %{event: kind, data: data})
       when kind in ["interaction.upvote_changed", "interaction.collect_changed"] do
    with id when is_integer(id) <- data["community_id"],
         %Community{} = community <- Repo.get(Community, id),
         {:ok, _view} <- CMS.Articles.Store.load_article_for_notification(article.id, community) do
      {:ok, Map.put(article, :community, community)}
    else
      _ -> {:error, ErrorCat.interaction_target_invalid()}
    end
  end

  defp request_context(target, _event), do: {:ok, target}

  defp load_target("article", id) do
    case Repo.get(Article, id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, ErrorCat.interaction_target_not_found()}
    end
  end

  defp load_target("comment", id) do
    case Repo.get(Comment, id) do
      %Comment{} = comment -> {:ok, comment}
      nil -> {:error, ErrorCat.interaction_target_not_found()}
    end
  end

  defp load_target(_, _), do: {:error, ErrorCat.interaction_target_invalid()}

  defp load_actor(id) when is_integer(id) or is_binary(id) do
    case Repo.get(User, id) do
      %User{} = actor -> {:ok, actor}
      nil -> {:error, ErrorCat.interaction_actor_not_found()}
    end
  end

  defp load_actor(_), do: {:error, ErrorCat.interaction_actor_invalid()}

  @doc "Projects immutable business fields for duplicate Outbox comparison."
  def payload_projection(event, data) do
    case event do
      "interaction.collect_changed" ->
        CMS.Outbox.Event.project_fields(data, ["actor_id", "operation", "community_id"])

      "interaction.emotion_changed" ->
        CMS.Outbox.Event.project_fields(data, ["actor_id", "operation", "emotion", "community_id"])

      "interaction.upvote_changed" ->
        CMS.Outbox.Event.project_fields(data, ["actor_id", "operation", "community_id"])

      _ ->
        {:error, {:outbox_event_owner_missing, event}}
    end
  end
end
