defmodule GroupherServer.CMS.Seeds.Comments do
  @moduledoc false

  import GroupherServer.Support.Factory
  import Helper.Utils, only: [get_config: 2]
  import GroupherServer.CMS.Model.Embeds.CommentEmotion, only: [default_emotions: 0]
  import GroupherServer.CMS.Model.Embeds.CommentMeta, only: [default_meta: 0]

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Seeds.Config

  alias CMS.Model.{Comment, Community}
  alias Helper.{ORM, T}

  @comment_emotions get_config(:article, :comment_emotions)
  @comment_count_range {Config.comment_count_per_article(), Config.comment_count_per_article()}
  @comment_upvotes_range Config.comment_upvotes_range()
  @comment_replies_range Config.comment_replies_range()

  @spec mock(Community.t(), atom(), map(), keyword()) :: T.domain_res([Comment.t()])
  def mock(%Community{} = community, thread, article, opts \\ [])
      when thread in [:post, :changelog, :doc] do
    range = Keyword.get(opts, :count_range, @comment_count_range)
    upvotes_range = Keyword.get(opts, :upvotes_range, @comment_upvotes_range)
    replies_range = Keyword.get(opts, :replies_range, @comment_replies_range)
    seed_replies = Keyword.get(opts, :seed_replies, true)
    count = random_range(range)
    {:ok, commenter} = db_insert(:user)

    comments =
      Enum.reduce(1..count, [], fn index, acc ->
        {:ok, comment} = create_top_comment(community, thread, article, commenter, index)

        {:ok, comment} = seed_upvotes(comment, upvotes_range)
        {:ok, comment} = seed_emotions(comment)

        if seed_replies do
          mock_replies(comment, count_range: replies_range)
        end

        [comment | acc]
      end)

    {:ok, Enum.reverse(comments)}
  end

  @spec mock_replies(Comment.t()) :: T.domain_res(:ok)
  def mock_replies(%Comment{} = comment), do: mock_replies(comment, [])

  @spec mock_replies(Comment.t(), keyword()) :: T.domain_res(:ok)
  def mock_replies(%Comment{} = comment, opts) do
    range = Keyword.get(opts, :count_range, @comment_replies_range)
    count = random_range(range)

    with {:ok, users} <- db_insert_multi(:user, count) do
      users
      |> Enum.each(fn user ->
        text = Faker.Lorem.sentence(20)
        {:ok, _} = create_reply(comment, text, user)
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

  defp seed_upvotes(%Comment{} = comment, {min, max}) do
    target_count = Enum.random(min..max)

    Enum.each(1..target_count, fn _ ->
      {:ok, user} = db_insert(:user)
      {:ok, _} = CMS.Comments.upvote_comment(comment.id, user)
    end)

    ORM.find(Comment, comment.id)
  end

  defp seed_upvotes(%Comment{} = comment, _) do
    seed_upvotes(comment, @comment_upvotes_range)
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

  defp random_range(_), do: 23

  defp create_reply(comment, text, user) do
    body = mock_comment(text)

    attrs = %{
      body: body,
      body_html: body,
      author_id: user.id,
      reply_to_id: comment.id,
      thread: comment.thread,
      floor: 0,
      is_article_author: false,
      upvotes_count: 0,
      emotions: default_emotions(),
      meta: default_meta(),
      post_id: comment.post_id,
      changelog_id: comment.changelog_id,
      doc_id: comment.doc_id
    }

    ORM.create(Comment, attrs)
  end

  defp create_top_comment(_community, thread, article, user, floor) do
    body = mock_comment("#{Faker.Lorem.sentence(12)} #{floor}")
    thread_name = thread |> to_string() |> String.upcase()

    attrs =
      %{
        body: body,
        body_html: body,
        author_id: user.id,
        thread: thread_name,
        floor: floor,
        is_article_author: false,
        upvotes_count: 0,
        emotions: default_emotions(),
        meta: default_meta()
      }
      |> put_article_fk(thread, article.id)

    ORM.create(Comment, attrs)
  end

  defp put_article_fk(attrs, :post, id), do: Map.put(attrs, :post_id, id)
  defp put_article_fk(attrs, :changelog, id), do: Map.put(attrs, :changelog_id, id)
  defp put_article_fk(attrs, :doc, id), do: Map.put(attrs, :doc_id, id)
end
