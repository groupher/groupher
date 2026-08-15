defmodule GroupherServer.CMS.Helper.EmotionToggle do
  @moduledoc """
  Shared write-path helpers for article/comment emotion toggles.

  Design intent: `persist/4` only changes the fact table. The reaction
  projection is updated by the CMS reaction context in the same transaction.

  Example:

      iex> EmotionToggle.persist(CommentUserEmotion, %{comment_id: 1, user_id: 2, received_user_id: 3}, :beer, true)
      {:ok, true}

      iex> EmotionToggle.persist(CommentUserEmotion, %{comment_id: 1, user_id: 2, received_user_id: 3}, :beer, true)
      {:ok, false}

  The second call is idempotent because the same `(target, user, emotion)` row
  already exists.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> EmotionToggle
        -> Repo / external boundary
  """

  alias Helper.ORM

  @spec persist(module(), map(), atom(), boolean()) :: {:ok, boolean()} | {:error, term()}
  def persist(schema, target, emotion, desired_state) when is_boolean(desired_state) do
    target = Map.put(target, :emotion, to_string(emotion))

    case ORM.find_by(schema, target) do
      {:ok, emotion_record} ->
        case desired_state do
          true -> {:ok, false}
          false -> emotion_record |> ORM.delete() |> to_change_result()
        end

      {:error, _} ->
        case desired_state do
          true -> target |> then(&ORM.create(schema, &1)) |> to_change_result()
          false -> {:ok, false}
        end
    end
  end

  defp to_change_result({:ok, _record}), do: {:ok, true}
  defp to_change_result({:error, reason}), do: {:error, reason}
end
