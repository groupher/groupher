defmodule GroupherServer.CMS.Comments.Emotion do
  @moduledoc """
  Comment emotion writes backed by fact rows and emotion projections.

  Business position:

      GraphQL mutation -> CMS.Comments.Emotion -> emotion fact + interaction projection
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User

  alias CMS.{Events, FrontDesk, Gate}
  alias CMS.Gate.Allow
  alias CMS.Interactions.State
  alias CMS.Helper.EmotionToggle
  alias CMS.Model.CommentUserEmotion
  alias Helper.{Later, Multi, T}

  @spec set(T.id(), atom(), User.t()) :: T.domain_res(term())
  def set(comment_id, emotion, %User{} = user), do: toggle(comment_id, emotion, user, true)

  @spec undo(T.id(), atom(), User.t()) :: T.domain_res(term())
  def undo(comment_id, emotion, %User{} = user), do: toggle(comment_id, emotion, user, false)

  defp toggle(comment_id, emotion, user, desired_state) do
    with {:ok, comment} <- FrontDesk.get(CMS.Model.Comment, comment_id),
         {:ok, article} <- FrontDesk.article_of(comment, preload: :community),
         {:ok, comment} <- Gate.access_check(user, :emotion, comment) do
      with {:ok, _thread_key} <-
             Allow.emotion(article.community.slug, :comment, comment.thread, emotion) do
        target = %{
          comment_id: comment.id,
          received_user_id: comment.author_id,
          user_id: user.id
        }

        Multi.new()
        |> Multi.run(:persist_user_emotion, fn _, _ ->
          EmotionToggle.persist(CommentUserEmotion, target, emotion, desired_state)
        end)
        |> Multi.run(:sync_projection, fn _, %{persist_user_emotion: changed?} ->
          operation = if desired_state, do: :add, else: :remove

          with :ok <- maybe_sync_projection(comment, emotion, user, changed?, operation) do
            {:ok, State.read(comment, user)}
          end
        end)
        |> Multi.run(:after_events, fn _, _ ->
          if desired_state do
            Later.run({Events, :emit, [:subscribe_community, %{target: comment, user: user}]})
          else
            {:ok, :pass}
          end
        end)
        |> Repo.transaction()
        |> result()
      end
    end
  end

  defp maybe_sync_projection(_comment, _emotion, _user, false, _operation), do: :ok

  defp maybe_sync_projection(comment, emotion, user, true, operation) do
    {:ok, _projection} = State.write(comment, {:emotion, emotion}, user, operation)
    :ok
  end

  defp result({:ok, %{sync_projection: comment}}), do: {:ok, comment}
  defp result({:error, _, result, _steps}), do: {:error, result}
end
