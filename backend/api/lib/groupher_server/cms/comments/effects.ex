defmodule GroupherServer.CMS.Comments.Effects do
  @moduledoc """
  Owns durable effect intents emitted by Comment mutations.

  The caller owns the current Command transaction. This module only builds the
  bounded Outbox intent; the Comment cleanup worker performs post-commit
  cache, search, mention reconciliation, and subscription delivery.

      Comment Command
        -> Comments.Effects
        -> CMS.Outbox
        -> Comment cleanup worker
  """

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.ArtimentMentions.{GraphRevision, SyncProgress}
  alias CMS.Model.{Comment, CommentBody, Community}

  @doc "Records one Comment effect in the caller-owned transaction."
  @spec enqueue(String.t(), String.t(), term(), Ecto.UUID.t(), map(), keyword()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue(event, resource_type, resource_id, command_id, data, opts \\ [])

  def enqueue(event, resource_type, resource_id, command_id, data, opts)
      when is_binary(event) and is_binary(resource_type) and is_binary(command_id) and
             is_map(data) and is_list(opts) do
    with {:ok, token} <- maybe_mark_mention_pending(event, resource_id),
         {:ok, effect} <-
           %{
             event: event,
             worker: GroupherServer.Jobs.CMSOutboxComment,
             resource_type: resource_type,
             resource_id: resource_id,
             identity: {:command, command_id},
             effect_key: Keyword.get(opts, :effect_key, "default"),
             data: data
           }
           |> CMS.Outbox.send(),
         {:ok, :pass} <- enqueue_mention_sync(resource_type, resource_id, command_id, token) do
      {:ok, effect}
    end
  end

  def enqueue(_event, _resource_type, _resource_id, _command_id, _data, _opts) do
    {:error, :comment_effect_identity_required}
  end

  @doc "Records the tombstone token and its dedicated Mention sync in the delete transaction."
  def enqueue_deleted_mention_sync(
        %Comment{id: id, body: %CommentBody{} = body} = comment,
        command_id
      )
      when is_binary(command_id) do
    token = "#{id}:#{body.version}:#{body.body_hash}"

    with {:ok, _state} <- SyncProgress.mark_pending_in_transaction(comment, token),
         {:ok, _event} <-
           CMS.Outbox.send(%{
             event: "comment.mention_sync",
             worker: GroupherServer.Jobs.CMSOutboxComment,
             resource_type: "comment",
             resource_id: id,
             identity: {:command, command_id},
             effect_key: token,
             data: %{content_token: token}
           }) do
      {:ok, :pass}
    end
  end

  def enqueue_deleted_mention_sync(_, _), do: {:error, :comment_mention_source_missing}

  defp maybe_mark_mention_pending(event, id)
       when event in ["comment.created", "comment.replied", "comment.updated"] and
              is_integer(id) do
    with %Comment{} = comment <- Repo.get(Comment, id),
         %CommentBody{version: version, body_hash: hash} <-
           Repo.get_by(CommentBody, comment_id: id),
         true <- is_integer(version) and is_binary(hash),
         {:ok, _state} <-
           SyncProgress.mark_pending_in_transaction(comment, "#{id}:#{version}:#{hash}"),
         {:ok, :pass} <- GraphRevision.bump_for_comment(comment) do
      {:ok, "#{id}:#{version}:#{hash}"}
    else
      nil -> {:error, :comment_mention_source_missing}
      false -> {:error, :comment_mention_token_missing}
      {:error, _} = error -> error
    end
  end

  defp maybe_mark_mention_pending(_event, _id), do: {:ok, nil}

  defp enqueue_mention_sync(_resource_type, _id, _command_id, nil), do: {:ok, :pass}

  defp enqueue_mention_sync(resource_type, id, command_id, token) do
    case CMS.Outbox.send(%{
           event: "comment.mention_sync",
           worker: GroupherServer.Jobs.CMSOutboxComment,
           resource_type: resource_type,
           resource_id: id,
           identity: {:command, command_id},
           effect_key: token,
           data: %{content_token: token}
         }) do
      {:ok, _event} -> {:ok, :pass}
      {:error, _} = error -> error
    end
  end

  @doc "Records one Comment activity in the caller-owned transaction."
  def activity(resource, event, opts), do: Activity.log(resource, event, opts)

  @doc "Reloads canonical resources and delivers one typed Comment effect."
  def deliver(:sync_mentions, %{"comment_id" => id}) do
    case comment(id) do
      {:ok, %Comment{} = comment} -> CMS.ArtimentMentions.sync_comment_public(comment)
      {:ok, :deleted} -> {:ok, :pass}
    end
  end

  def deliver(:subscribe_community, %{"community_id" => id, "actor_id" => actor_id}) do
    with %Community{} = community <- Repo.get(Community, id),
         {:ok, actor} <- user(actor_id) do
      CMS.Events.emit(:subscribe_community, %{target: community, user: actor})
    else
      nil -> {:error, :comment_effect_community_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def deliver(_type, _payload), do: {:error, :invalid_comment_effect}

  defp comment(id) do
    case Repo.get(Comment, id) do
      %Comment{} = comment -> {:ok, comment}
      nil -> {:ok, :deleted}
    end
  end

  defp user(id) do
    case Repo.get(User, id) do
      %User{} = user -> {:ok, user}
      nil -> {:error, :comment_effect_actor_not_found}
    end
  end
end
