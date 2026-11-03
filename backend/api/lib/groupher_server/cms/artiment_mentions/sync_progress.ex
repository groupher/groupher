defmodule GroupherServer.CMS.ArtimentMentions.SyncProgress do
  @moduledoc """
  Locks one stable Mention source and commits its content watermark.

      publication desired token -> source lock -> fact sync -> synced token
  """

  import Ecto.Query

  alias GroupherServer.Repo
  alias GroupherServer.CMS.ArtimentMentions.Model.SyncState
  alias GroupherServer.CMS.Model.{Article, ArticlePublic, Comment, CommentBody, DocPublic}

  @doc "Records a new desired token inside the resource owner's open transaction."
  def mark_pending_in_transaction(source, token) when is_binary(token) do
    with {:ok, identity} <- identity(source),
         {:ok, state} <- lock_state(identity, token) do
      state
      |> SyncState.changeset(%{desired_content_token: token})
      |> Repo.update()
    end
  end

  @doc "Locks the resource then its watermark, rejecting a stale body projection."
  def lock_current(source) do
    with {:ok, identity} <- identity(source),
         {:ok, token} <- canonical_token(identity),
         {:ok, :pass} <- compare_source_token(source, token),
         {:ok, state} <- lock_state(identity, token) do
      if state.desired_content_token == token do
        {:ok, {state, token}}
      else
        case state
             |> SyncState.changeset(%{desired_content_token: token})
             |> Repo.update() do
          {:ok, current} -> {:ok, {current, token}}
          {:error, reason} -> {:error, reason}
        end
      end
    end
  end

  @doc "Completes a zero or nonzero edge rebuild in the caller's transaction."
  def mark_synced_in_transaction(%SyncState{} = state, token) do
    state
    |> SyncState.changeset(%{
      desired_content_token: token,
      synced_content_token: token,
      synced_at: DateTime.utc_now() |> DateTime.truncate(:second)
    })
    |> Repo.update()
  end

  defp identity(%Comment{id: id, branch_id: branch_id}) when is_integer(id) do
    {:ok, %{source_type: :comment, source_comment_id: id, source_branch_id: branch_id}}
  end

  defp identity(%Article{id: id, thread: thread}) when is_binary(id) do
    {:ok, %{source_type: thread, source_article_id: id, source_branch_id: nil}}
  end

  defp identity(%{article_id: id, thread: thread} = source) when is_binary(id) do
    {:ok,
     %{
       source_type: thread,
       source_article_id: id,
       source_branch_id: Map.get(source, :branch_id)
     }}
  end

  defp identity(_), do: {:error, :invalid_mention_source}

  defp canonical_token(%{source_comment_id: id}) do
    case Repo.get(Comment, id) do
      nil ->
        {:error, :source_deleted}

      %Comment{article_id: article_id} ->
        case Repo.get(Article, article_id, lock: "FOR UPDATE") do
          nil ->
            {:error, :source_deleted}

          _parent ->
            case Repo.get(Comment, id, lock: "FOR UPDATE") do
              nil ->
                {:error, :source_deleted}

              _comment ->
                case Repo.get_by(CommentBody, comment_id: id) do
                  %CommentBody{version: version, body_hash: hash}
                  when is_integer(version) and is_binary(hash) ->
                    {:ok, "#{id}:#{version}:#{hash}"}

                  _ ->
                    {:error, :source_body_missing}
                end
            end
        end
    end
  end

  defp canonical_token(%{source_type: :doc, source_article_id: id, source_branch_id: branch})
       when is_integer(branch) do
    case Repo.get(Article, id, lock: "FOR UPDATE") do
      nil ->
        {:error, :source_deleted}

      _article ->
        case Repo.get_by(DocPublic, article_id: id, branch_id: branch) do
          %DocPublic{branch_version_id: version_id, publication_version: version}
          when is_integer(version_id) and is_integer(version) ->
            {:ok, "#{branch}:#{version_id}:#{version}"}

          _ ->
            {:error, :source_publication_missing}
        end
    end
  end

  defp canonical_token(%{source_article_id: id}) do
    case Repo.get(Article, id, lock: "FOR UPDATE") do
      nil ->
        {:error, :source_deleted}

      _article ->
        case Repo.get(ArticlePublic, id) do
          %ArticlePublic{revision_id: revision_id, publication_version: version}
          when is_binary(revision_id) and is_integer(version) ->
            {:ok, "#{revision_id}:#{version}"}

          _ ->
            {:error, :source_publication_missing}
        end
    end
  end

  defp compare_source_token(%Comment{body: %CommentBody{} = body} = source, token) do
    if "#{source.id}:#{body.version}:#{body.body_hash}" == token,
      do: {:ok, :pass},
      else: {:error, :stale_mention_source}
  end

  defp compare_source_token(
         %{
           thread: :doc,
           branch_id: branch_id,
           branch_version_id: version_id,
           publication_version: version
         },
         token
       )
       when is_integer(branch_id) and is_integer(version_id) and is_integer(version) do
    if "#{branch_id}:#{version_id}:#{version}" == token,
      do: {:ok, :pass},
      else: {:error, :stale_mention_source}
  end

  defp compare_source_token(%{revision_id: revision_id, publication_version: version}, token)
       when is_binary(revision_id) and is_integer(version) do
    if "#{revision_id}:#{version}" == token,
      do: {:ok, :pass},
      else: {:error, :stale_mention_source}
  end

  defp compare_source_token(_source, _token), do: {:ok, :pass}

  defp lock_state(identity, token) do
    attrs =
      identity
      |> Map.put(:desired_content_token, token)
      |> Map.put(:inserted_at, DateTime.utc_now() |> DateTime.truncate(:second))
      |> Map.put(:updated_at, DateTime.utc_now() |> DateTime.truncate(:second))

    Repo.insert_all(SyncState, [attrs], on_conflict: :nothing)

    query =
      case identity do
        %{source_comment_id: comment_id} ->
          where(SyncState, [state], state.source_comment_id == ^comment_id)

        %{source_article_id: article_id, source_branch_id: nil} ->
          where(
            SyncState,
            [state],
            state.source_article_id == ^article_id and is_nil(state.source_branch_id)
          )

        %{source_article_id: article_id, source_branch_id: branch_id} ->
          where(
            SyncState,
            [state],
            state.source_article_id == ^article_id and state.source_branch_id == ^branch_id
          )
      end

    case Repo.one(from(state in query, lock: "FOR UPDATE")) do
      %SyncState{} = state -> {:ok, state}
      nil -> {:error, :sync_state_missing}
    end
  end
end
