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

  import Ecto.Query

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Artiment.PlateJSON
  alias CMS.ArtimentMentions.Commands.CaptureCurrentVersion
  alias CMS.ArtimentMentions.MentionsGraphRevision, as: Revision
  alias CMS.Model.{Article, Comment, CommentBody, Community, DocBranch, DocBranchVersion}

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
    with {:ok, _captured} <-
           capture_current_comment(event, resource_id, command_id, Map.get(data, :community_id)),
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
           |> CMS.Outbox.send() do
      {:ok, effect}
    end
  end

  def enqueue(_event, _resource_type, _resource_id, _command_id, _data, _opts) do
    {:error, :comment_effect_identity_required}
  end

  @doc "Captures the tombstone body in the delete Command transaction."
  def capture_deleted_version(
        %Comment{body: %CommentBody{} = body} = comment,
        command_id,
        community_id
      )
      when is_binary(command_id) and (is_nil(community_id) or is_integer(community_id)) do
    capture_comment_body(comment, body, {:command, command_id}, community_id)
    |> case do
      {:ok, _captured} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  def capture_deleted_version(_, _, _), do: {:error, :comment_mention_source_missing}

  defp capture_current_comment(event, id, command_id, community_id)
       when event in ["comment.created", "comment.replied", "comment.updated"] and
              is_integer(id) and is_binary(command_id) and
              (is_nil(community_id) or is_integer(community_id)) do
    with %Comment{} = comment <- Repo.get(Comment, id),
         %CommentBody{} = body <-
           Repo.get_by(CommentBody, comment_id: id),
         {:ok, captured} <-
           capture_comment_body(comment, body, {:command, command_id}, community_id),
         {:ok, :pass} <- Revision.bump() do
      {:ok, captured}
    else
      nil -> {:error, :comment_mention_source_missing}
      {:error, _} = error -> error
    end
  end

  defp capture_current_comment(_event, _id, _command_id, _community_id), do: {:ok, :pass}

  defp capture_comment_body(
         %Comment{id: id, article_id: article_id, thread: thread},
         %CommentBody{version: version, body_hash: hash, json: json, updated_at: updated_at},
         identity,
         requested_community_id
       )
       when is_integer(id) and is_binary(article_id) and is_integer(version) and is_binary(hash) and
              is_binary(json) do
    with %Article{} <- Repo.get(Article, article_id),
         {:ok, ast} <- PlateJSON.decode(json),
         {:ok, community_id} <- comment_community_id(thread, article_id, requested_community_id),
         true <- match?(%DateTime{}, updated_at),
         {:ok, captured} <-
           CaptureCurrentVersion.execute_in_transaction(
             %{
               type: :comment,
               comment_id: id,
               parent: %{type: thread, article_id: article_id}
             },
             "#{id}:#{version}:#{hash}",
             ast,
             community_id,
             updated_at,
             identity
           ) do
      {:ok, captured}
    else
      nil -> {:error, :comment_parent_article_missing}
      false -> {:error, :comment_mention_time_missing}
      {:error, _reason} = error -> error
      _ -> {:error, :comment_mention_source_missing}
    end
  end

  defp capture_comment_body(_, _, _, _), do: {:error, :comment_mention_source_missing}

  defp comment_community_id(:doc, article_id, requested_community_id) do
    owners =
      from(version in DocBranchVersion,
        join: branch in DocBranch,
        on: branch.id == version.branch_id and branch.type == :main,
        where: version.article_id == ^article_id,
        select: branch.community_id,
        distinct: true
      )
      |> Repo.all()

    case owners do
      [owner_id] when is_nil(requested_community_id) or requested_community_id == owner_id ->
        {:ok, owner_id}

      [_owner_id] ->
        {:error, :comment_mention_community_mismatch}

      _ ->
        {:error, :comment_mention_owner_missing_or_ambiguous}
    end
  end

  defp comment_community_id(_thread, _article_id, community_id) when is_integer(community_id) do
    {:ok, community_id}
  end

  defp comment_community_id(_thread, _article_id, _) do
    {:error, :scope_context_missing}
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
