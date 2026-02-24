defmodule GroupherServer.CMS.Seeds do
  @moduledoc """
  CMS seeds for database initialization.
  Should be called ONLY in new database, like migration.
  """

  import GroupherServer.Support.Factory
  import Helper.Utils, only: [done: 1, get_config: 2]
  import Ecto.Query, warn: false

  import GroupherServer.CMS.Seeds.Helper,
    only: [
      threadify_communities: 2,
      tagfy_threads: 4,
      categorify_communities: 3,
      seed_bot: 0,
      seed_threads: 1,
      seed_categories_ifneed: 1,
      insert_community: 3
    ]

  alias GroupherServer.CMS
  alias Helper.ORM
  alias Helper.Types, as: T

  alias CMS.Model.{Category, Comment, Community, Post}

  alias __MODULE__.{Communities, Domain}

  @article_threads get_config(:article, :threads)
  @community_types [:pl, :framework]
  @comment_emotions get_config(:article, :comment_emotions)

  # Community seeds

  @spec communities(atom()) :: T.domain_res(:ok)
  def communities(type) when type in @community_types do
    Communities.get(type) |> Enum.each(&community(&1, type)) |> done
  end

  @spec community(atom()) :: T.domain_res(Community.t())
  def community(:home), do: Domain.seed_community(:home)
  def community(:feedback), do: Domain.seed_community(:feedback)

  @spec community(atom(), atom()) :: T.domain_res(Community.t())
  def community(slug, type) when type in @community_types do
    with {:ok, threads} <- seed_threads(type),
         {:ok, bot} <- seed_bot(),
         {:ok, categories} <- seed_categories_ifneed(bot),
         {:ok, community} <- insert_community(bot, slug, type) do
      threadify_communities([community], threads.entries)
      tagfy_threads([community], threads.entries, bot, type)
      categorify_communities([community], categories, type)

      {:ok, community}
    end
  end

  def community(_slug, _type), do: {:error, {:custom, "unknown community type"}}

  @spec set_category([atom() | String.t()], atom() | String.t()) :: T.domain_res(:ok)
  def set_category(communities_names, cat_name) when is_list(communities_names) do
    {:ok, category} = ORM.find_by(Category, %{slug: cat_name})

    Enum.each(communities_names, fn name ->
      {:ok, community} = ORM.find_by(Community, %{slug: name})

      {:ok, _} =
        CMS.Communities.set_category(%Community{id: community.id}, %Category{id: category.id})
    end)

    {:ok, :ok}
  end

  # Article seeds

  @spec articles(Community.t(), atom()) :: T.domain_res(:ok)
  def articles(%Community{} = community, thread) when is_atom(thread) do
    seed_articles(community, thread, 3)
  end

  @spec articles(Community.t(), atom(), integer()) :: T.domain_res(:ok)
  def articles(%Community{} = community, thread, count)
      when is_atom(thread) and is_integer(count) do
    seed_articles(community, thread, count)
  end

  @spec seed_articles(Community.t(), atom(), integer()) :: T.domain_res(:ok)
  defp seed_articles(%Community{} = community, thread, count)
       when thread in @article_threads do
    thread_upcase = thread |> to_string |> String.upcase()
    tags_filter = %{community_id: community.id, thread: thread_upcase}

    with {:ok, community} <- ORM.find(Community, community.id),
         {:ok, tags} <- CMS.Communities.paged_tags(tags_filter),
         {:ok, user} <- db_insert(:user) do
      1..count
      |> Enum.each(fn _ ->
        attrs = mock_attrs(thread, %{community_id: community.id})
        {:ok, article} = CMS.Articles.create(community, thread, attrs, user)
        seed_tags(tags, thread, article)
        seed_comments(thread, article.id, user)
        seed_upvotes(article)
      end)
    end
  end

  defp seed_upvotes(article) do
    with {:ok, users} <- db_insert_multi(:user, Enum.random(1..10)) do
      users
      |> Enum.each(fn user ->
        {:ok, _article} = CMS.Articles.upvote(article, user)
      end)
    end
  end

  defp seed_tags(tags, thread, article) do
    get_tag_ids(tags, thread)
    |> Enum.each(fn tag_id ->
      {:ok, _} = CMS.Communities.set_tag(article, tag_id)
    end)
  end

  defp get_tag_ids(tags, _) do
    tags.entries |> Enum.map(& &1.id) |> Enum.shuffle() |> Enum.take(1)
  end

  defp seed_comments(_thread, _article_id, _user) do
    0..Enum.random(1..5)
    |> Enum.each(fn _ ->
      _text = Faker.Lorem.sentence(20)
    end)
  end

  # Comment seeds

  @spec comment_replies(Comment.t()) :: T.domain_res(:ok)
  def comment_replies(%Comment{} = comment) do
    with {:ok, users} <- db_insert_multi(:user, Enum.random(1..5)) do
      users
      |> Enum.each(fn user ->
        text = Faker.Lorem.sentence(20)
        {:ok, _} = CMS.Comments.reply_comment(comment.id, mock_comment(text), user)
      end)
    end
  end

  @spec comment_emotions(Comment.t()) :: T.domain_res(:ok)
  def comment_emotions(%Comment{} = comment) do
    with {:ok, users} <- db_insert_multi(:user, Enum.random(1..5)) do
      users
      |> Enum.each(fn user ->
        emotion = @comment_emotions |> Enum.random()
        {:ok, _} = CMS.Comments.emotion_to_comment(comment.id, emotion, user)
      end)
    end
  end

  # Clean up

  @spec clean_up_community(atom()) :: T.domain_res(Community.t())
  def clean_up_community(slug) do
    with {:ok, community} <- ORM.findby_delete(Community, %{slug: to_string(slug)}) do
      clean_up_articles(community, :post)
    end
  end

  @spec clean_up_articles(Community.t(), atom()) :: T.domain_res(:ok)
  def clean_up_articles(%Community{} = community, :post) do
    Post
    |> join(:inner, [p], c in assoc(p, :community))
    |> where([p, c], c.id == ^community.id)
    |> ORM.delete_all(:if_exist)
    |> done
  end

  def clean_up_articles(_, _), do: {:ok, :pass}
end
