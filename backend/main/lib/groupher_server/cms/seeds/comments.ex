defmodule GroupherServer.CMS.Seeds.Comments do
  @moduledoc false

  import GroupherServer.Support.Factory
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS

  alias CMS.Model.{Comment, Community}
  alias Helper.{ORM, T}

  @comment_emotions get_config(:article, :comment_emotions)

  @spec mock(Community.t(), atom(), map(), keyword()) :: T.domain_res([Comment.t()])
  def mock(%Community{} = community, thread, article, opts \\ [])
      when thread in [:post, :changelog, :doc] do
    range = Keyword.get(opts, :count_range, {20, 30})
    count = random_range(range)
    {:ok, commenter} = db_insert(:user)

    comments =
      Enum.reduce(1..count, [], fn index, acc ->
        body = mock_comment("#{Faker.Lorem.sentence(12)} #{index}")
        {:ok, comment} = CMS.Comments.create_comment(community, thread, article.inner_id, body, commenter)

        {:ok, comment} = seed_upvotes(comment)
        {:ok, comment} = seed_emotions(comment)

        [comment | acc]
      end)

    {:ok, Enum.reverse(comments)}
  end

  @spec mock_replies(Comment.t()) :: T.domain_res(:ok)
  def mock_replies(%Comment{} = comment) do
    with {:ok, users} <- db_insert_multi(:user, Enum.random(1..5)) do
      users
      |> Enum.each(fn user ->
        text = Faker.Lorem.sentence(20)
        {:ok, _} = CMS.Comments.reply_comment(comment.id, mock_comment(text), user)
      end)
    end
  end

  @spec mock_emotions(Comment.t()) :: T.domain_res(:ok)
  def mock_emotions(%Comment{} = comment) do
    with {:ok, users} <- db_insert_multi(:user, Enum.random(1..5)) do
      users
      |> Enum.each(fn user ->
        emotion = @comment_emotions |> Enum.random()
        {:ok, _} = CMS.Comments.emotion_to_comment(comment.id, emotion, user)
      end)
    end
  end

  defp seed_upvotes(%Comment{} = comment) do
    with {:ok, user} <- db_insert(:user),
         {:ok, _} <- CMS.Comments.upvote_comment(comment.id, user),
         {:ok, comment} <- ORM.find(Comment, comment.id),
         {:ok, comment} <- ORM.update(comment, %{upvotes_count: Enum.random(2..12)}) do
      {:ok, comment}
    end
  end

  defp seed_emotions(%Comment{} = comment) do
    with {:ok, user} <- db_insert(:user),
         emotion <- Enum.random(@comment_emotions),
         {:ok, _} <- CMS.Comments.emotion_to_comment(comment.id, emotion, user),
         {:ok, comment} <- ORM.find(Comment, comment.id),
         emotions <- randomize_emotions(comment.emotions),
         {:ok, comment} <- ORM.update_embed(comment, :emotions, emotions) do
      {:ok, comment}
    end
  end

  defp randomize_emotions(emotions) do
    emotions
    |> Map.from_struct()
    |> Enum.reduce(%{}, fn {key, value}, acc ->
      key_str = Atom.to_string(key)

      cond do
        String.ends_with?(key_str, "_count") ->
          Map.put(acc, key, Enum.random(0..6))

        String.starts_with?(key_str, "viewer_has_") ->
          Map.put(acc, key, false)

        String.starts_with?(key_str, "latest_") ->
          Map.put(acc, key, value || [])

        true ->
          Map.put(acc, key, value)
      end
    end)
  end

  defp random_range({min, max}) when is_integer(min) and is_integer(max) and min <= max,
    do: Enum.random(min..max)

  defp random_range(_), do: Enum.random(20..30)
end
