defmodule GroupherServer.CMS.Seeds.Articles do
  @moduledoc false

  import GroupherServer.Support.Factory
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS

  alias CMS.Model.Community
  alias Helper.{ORM, T}

  alias GroupherServer.CMS.Seeds.{Comments, Config, Tags}

  @article_emotions get_config(:article, :emotions)
  @article_count_range {Config.article_count_per_thread(), Config.article_count_per_thread()}
  @article_upvotes_range Config.article_upvotes_range()
  @comment_count_range {Config.comment_count_per_article(), Config.comment_count_per_article()}
  @comment_upvotes_range Config.comment_upvotes_range()
  @comment_replies_range Config.comment_replies_range()

  @spec mock(String.t(), atom()) :: T.domain_res(map())
  def mock(community_slug, thread) when is_binary(community_slug) and is_atom(thread) do
    with {:ok, community} <- ORM.find_by(Community, slug: community_slug),
         {:ok, user} <- db_insert(:user) do
      attrs = mock_attrs(thread, %{community_id: community.id, community: community})
      CMS.Articles.create(community, thread, attrs, user)
    end
  end

  @spec mock(Community.t(), atom()) :: T.domain_res([map()])
  def mock(%Community{} = community, thread) when is_atom(thread) do
    mock(community, thread, count_range: @article_count_range)
  end

  def mock(community, thread, opts_or_count \\ [])

  @spec mock(Community.t(), atom(), integer()) :: T.domain_res([map()])
  def mock(%Community{} = community, thread, count)
      when is_atom(thread) and is_integer(count) and count >= 0 do
    mock(community, thread, count_range: {count, count})
  end

  @spec mock(Community.t(), atom(), keyword()) :: T.domain_res([map()])
  def mock(%Community{} = community, thread, opts) when is_list(opts) and thread in [:post, :changelog, :doc] do
    article_range = Keyword.get(opts, :count_range, @article_count_range)
    comment_range = Keyword.get(opts, :comment_range, @comment_count_range)
    article_upvotes_range = Keyword.get(opts, :upvotes_range, @article_upvotes_range)
    comment_upvotes_range = Keyword.get(opts, :comment_upvotes_range, @comment_upvotes_range)
    replies_range = Keyword.get(opts, :replies_range, @comment_replies_range)
    count = random_range(article_range)

    tag_ids =
      case Keyword.get(opts, :tag_ids) do
        ids when is_list(ids) and ids != [] -> ids
        _ ->
          {:ok, ids} = Tags.mock(community, thread)
          ids
      end

    articles =
      Enum.reduce(1..count, [], fn _index, acc ->
        {:ok, author} = db_insert(:user)
        attrs = mock_attrs(thread, %{community_id: community.id})
        {:ok, article} = CMS.Articles.create(community, thread, attrs, author)

        attach_tags(article, tag_ids)
        {:ok, article} = seed_upvotes(article, article_upvotes_range)
        {:ok, article} = seed_emotions(article)

        Comments.mock(
          community,
          thread,
          article,
          count_range: comment_range,
          upvotes_range: comment_upvotes_range,
          replies_range: replies_range,
          seed_replies: true
        )

        [article | acc]
      end)

    {:ok, Enum.reverse(articles)}
  end

  defp attach_tags(_article, []), do: :ok

  defp attach_tags(article, tag_ids) do
    count = Enum.random(1..min(3, length(tag_ids)))

    tag_ids
    |> Enum.shuffle()
    |> Enum.take(count)
    |> Enum.each(fn tag_id ->
      CMS.Communities.set_tag(article, tag_id)
    end)
  end

  defp seed_upvotes(article, {min, max}) do
    with {:ok, user} <- db_insert(:user),
         {:ok, _} <- CMS.Articles.upvote(article, user),
         {:ok, article} <- ORM.find(article.__struct__, article.id),
         {:ok, article} <- ORM.update(article, %{upvotes_count: Enum.random(min..max)}) do
      {:ok, article}
    end
  end

  defp seed_upvotes(article, _) do
    seed_upvotes(article, @article_upvotes_range)
  end

  defp seed_emotions(article) do
    with {:ok, user} <- db_insert(:user),
         emotion <- Enum.random(@article_emotions),
         {:ok, _} <- CMS.Articles.emotion(article, emotion, user),
         {:ok, article} <- ORM.find(article.__struct__, article.id),
         emotions <- randomize_emotions(article.emotions),
         {:ok, article} <- ORM.update_embed(article, :emotions, emotions) do
      {:ok, article}
    end
  end

  defp randomize_emotions(emotions) do
    emotions
    |> Map.from_struct()
    |> Enum.reduce(%{}, fn {key, value}, acc ->
      key_str = Atom.to_string(key)

      cond do
        String.ends_with?(key_str, "_count") ->
          Map.put(acc, key, Enum.random(0..8))

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
