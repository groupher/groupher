defmodule GroupherServer.CMS.Comments.Effects do
  @moduledoc """
  Owns durable effect intents emitted by Comment mutations.

  The caller owns the current Command transaction. This module only builds the
  bounded Outbox intent; the Comment cleanup worker performs post-commit
  cache, search, and subscription delivery. Mentions are updated by the
  owning Comment Command before commit.

      Comment Command
        -> Comments.Effects
        -> CMS.Outbox
        -> Comment cleanup worker
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Model.{Article, Community}

  @doc "Persists summary invalidation for every public binding in the owner transaction."
  @spec summary_changed(Article.t(), pos_integer(), boolean()) :: {:ok, :pass} | {:error, term()}
  def summary_changed(article, revision, count_changed?) do
    bindings =
      from(binding in CMS.Model.ArticleBinding,
        join: community in CMS.Model.Community,
        on: community.id == binding.community_id,
        where: binding.article_id == ^article.id,
        select: {binding, community}
      )
      |> Repo.all()

    Enum.reduce_while(bindings, {:ok, :pass}, fn {binding, community}, _ ->
      case CMS.Outbox.send(%{
             event: "comment.changed",
             worker: GroupherServer.Jobs.CMSOutboxComment,
             resource_type: "article",
             resource_id: article.id,
             identity: {:workflow, "comment-summary:#{article.id}:#{revision}"},
             effect_key: "comment.changed:#{community.id}",
             data: %{
               article_id: article.id,
               community_id: community.id,
               community: community.slug,
               inner_id: binding.inner_id,
               thread: article.thread,
               comments_revision: revision,
               count_changed: count_changed?
             }
           }) do
        {:ok, _} -> {:cont, {:ok, :pass}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  @doc "Records one Comment effect in the caller-owned transaction."
  @spec enqueue(String.t(), String.t(), term(), Ecto.UUID.t(), map(), keyword()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue(event, resource_type, resource_id, command_id, data, opts \\ [])

  def enqueue(event, resource_type, resource_id, command_id, data, opts)
      when is_binary(event) and is_binary(resource_type) and is_binary(command_id) and
             is_map(data) and is_list(opts) do
    CMS.Outbox.send(%{
      event: event,
      worker: GroupherServer.Jobs.CMSOutboxComment,
      resource_type: resource_type,
      resource_id: resource_id,
      identity: {:command, command_id},
      effect_key: Keyword.get(opts, :effect_key, "default"),
      data: data
    })
  end

  def enqueue(_event, _resource_type, _resource_id, _command_id, _data, _opts) do
    {:error, :comment_effect_identity_required}
  end

  @doc "Records one Comment activity in the caller-owned transaction."
  def activity(resource, event, opts), do: Activity.log(resource, event, opts)

  @doc "Reloads canonical resources and delivers one typed Comment effect."
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

  defp user(id) do
    case Repo.get(User, id) do
      %User{} = user -> {:ok, user}
      nil -> {:error, :comment_effect_actor_not_found}
    end
  end
end
