defmodule GroupherServer.CMS.Comments.Mentions do
  @moduledoc """
  Captures a published Comment body inside its owning Command transaction.

      Comment create or edit -> selected body -> current Mention edges
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.PlateJSON
  alias CMS.ArtimentMentions
  alias CMS.Model.{Article, Comment, CommentBody, DocBranch, DocBranchVersion}

  @doc "Updates the graph for one selected Comment body in the owning transaction."
  def update(%Comment{id: id}, command_id, community_id)
      when is_binary(command_id) and (is_nil(community_id) or is_integer(community_id)) do
    with %Comment{} = comment <- Repo.get(Comment, id),
         %CommentBody{} = body <- Repo.get_by(CommentBody, comment_id: id) do
      capture_comment_body(comment, body, {:command, command_id}, community_id)
    else
      nil -> {:error, :comment_mention_source_missing}
    end
  end

  def update(_, _, _), do: {:error, :comment_mention_source_missing}

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
           ArtimentMentions.update(
             %{
               type: :comment,
               comment_id: id,
               parent: %{type: thread, article_id: article_id}
             },
             %{
               published_revision_identity: "#{id}:#{version}:#{hash}",
               ast: ast,
               community_id: community_id,
               mentioned_at: updated_at
             },
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
end
