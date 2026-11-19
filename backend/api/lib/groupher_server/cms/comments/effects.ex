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
  alias CMS.Model.{Article, Comment, CommentBody, Community}
  alias CMS.Outbox.DedupeKey

  @doc "Persists summary invalidation for every public binding in the owner transaction."
  @spec summary_changed(Article.t(), pos_integer(), boolean(), Ecto.UUID.t()) ::
          {:ok, :pass} | {:error, term()}
  def summary_changed(article, revision, count_changed?, operation_ref) do
    bindings =
      from(binding in CMS.Model.ArticleBinding,
        join: community in CMS.Model.Community,
        on: community.id == binding.community_id,
        where: binding.article_id == ^article.id and not is_nil(binding.inner_id),
        select: {binding, community}
      )
      |> Repo.all()

    Enum.reduce_while(bindings, {:ok, :pass}, fn {binding, community}, _ ->
      case CMS.Outbox.send(%{
             event: "comment.changed",
             worker: GroupherServer.Jobs.CMSOutboxComment,
             resource_type: "article",
             resource_id: article.id,
             operation_ref: operation_ref,
             dedupe_key: DedupeKey.encode([revision, community.id]),
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

  @doc "Records the creation's frozen subscription Community."
  def created(%Comment{} = comment, %User{} = actor, %Community{} = community, operation_ref) do
    enqueue("comment.created", "comment", comment.id, [community.id], operation_ref, %{
      article_id: comment.article_id,
      actor_id: actor.id,
      community_id: community.id
    })
  end

  @doc "Records a reply once for its creation Community."
  def replied(%Comment{} = comment, %User{} = actor, %Community{} = community, operation_ref) do
    enqueue("comment.replied", "comment", comment.id, [community.id], operation_ref, %{
      article_id: comment.article_id,
      actor_id: actor.id,
      community_id: community.id
    })
  end

  @doc "Records an edit at its durable body version instead of reusing the first edit's key."
  def updated(
        %Comment{body: %CommentBody{version: version}} = comment,
        %User{} = actor,
        community_id,
        operation_ref
      ) do
    enqueue("comment.updated", "comment", comment.id, [version, community_id], operation_ref, %{
      article_id: comment.article_id,
      actor_id: actor.id,
      community_id: community_id,
      body_version: version
    })
  end

  @doc "Records metrics refresh independently for each deleted Comment on the same Article."
  def deleted(%Comment{} = comment, %Article{} = article, operation_ref) do
    enqueue("comment.deleted", "article", article.id, [comment.id], operation_ref, %{
      article_id: article.id,
      comment_id: comment.id
    })
  end

  defp enqueue(event, resource_type, resource_id, dimensions, operation_ref, data) do
    CMS.Outbox.send(%{
      event: event,
      worker: GroupherServer.Jobs.CMSOutboxComment,
      resource_type: resource_type,
      resource_id: resource_id,
      operation_ref: operation_ref,
      dedupe_key: DedupeKey.encode(dimensions),
      data: data
    })
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

  @doc "Projects immutable business fields for duplicate Outbox comparison."
  def payload_projection(event, data) do
    case event do
      "comment.changed" ->
        CMS.Outbox.Event.project_fields(data, [
          "article_id",
          "community_id",
          "community",
          "inner_id",
          "thread",
          "comments_revision",
          "count_changed"
        ])

      "comment.created" ->
        CMS.Outbox.Event.project_fields(data, ["article_id", "actor_id", "community_id"])

      "comment.deleted" ->
        CMS.Outbox.Event.project_fields(data, ["article_id", "comment_id"])

      "comment.replied" ->
        CMS.Outbox.Event.project_fields(data, ["article_id", "actor_id", "community_id"])

      "comment.updated" ->
        CMS.Outbox.Event.project_fields(data, [
          "article_id",
          "actor_id",
          "community_id",
          "body_version"
        ])

      _ ->
        {:error, {:outbox_event_owner_missing, event}}
    end
  end
end
