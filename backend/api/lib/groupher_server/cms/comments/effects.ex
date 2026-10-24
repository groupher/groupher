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
  alias CMS.Model.{Comment, Community}

  @doc "Records one Comment effect in the caller-owned transaction."
  @spec enqueue(String.t(), String.t(), term(), Ecto.UUID.t(), map(), keyword()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue(event, resource_type, resource_id, command_id, data, opts \\ [])

  def enqueue(event, resource_type, resource_id, command_id, data, opts)
      when is_binary(event) and is_binary(resource_type) and is_binary(command_id) and
             is_map(data) and is_list(opts) do
    %{
      event: event,
      worker: GroupherServer.Jobs.CMSOutboxComment,
      resource_type: resource_type,
      resource_id: resource_id,
      identity: {:command, command_id},
      effect_key: Keyword.get(opts, :effect_key, "default"),
      data: data
    }
    |> CMS.Outbox.send()
  end

  def enqueue(_event, _resource_type, _resource_id, _command_id, _data, _opts) do
    {:error, :comment_effect_identity_required}
  end

  @doc "Records one Comment activity in the caller-owned transaction."
  def activity(resource, event, opts), do: Activity.log(resource, event, opts)

  @doc "Reloads canonical resources and delivers one typed Comment effect."
  def deliver(:sync_mentions, %{"comment_id" => id}) do
    case comment(id) do
      {:ok, %Comment{} = comment} -> CMS.Events.emit(:sync_mentions, %{artiment: comment})
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
