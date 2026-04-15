defmodule GroupherServer.CMS.FrontDesk do
  @moduledoc """
  CMS domain front desk for reading/fetching and helper operations.
  """
  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher
  import ShortMaps

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Helper.Threads
  alias CMS.Model.{Comment, Community, Embeds}
  alias Helper.{ORM, QueryBuilder, T}

  @article_threads Application.compile_env(:groupher_server, :article, [])
                   |> Keyword.get(:threads, [])
  @default_article_meta CMS.Model.Embeds.ArticleMeta.default_meta()
  @max_latest_upvoted_users_count Application.compile_env(:groupher_server, :article, [])
                                  |> Keyword.get(:max_upvoted_users_count, 10)

  @max_latest_emotion_users_count 4
  @supported_emotions Application.compile_env(:groupher_server, :article, [])
                      |> Keyword.get(:emotions, [])
  @supported_comment_emotions Application.compile_env(:groupher_server, :article, [])
                              |> Keyword.get(:comment_emotions, [])

  @spec community(String.t()) :: {:ok, Community.t()} | {:error, map()}
  def community(slug) when is_binary(slug) do
    Community
    |> where([c], c.slug == ^slug or c.aka == ^slug)
    |> preload(:dashboard)
    |> preload(moderators: :user)
    |> Repo.one()
    |> done()
    |> case do
      {:ok, community} -> ORM.fill_meta(community)
      {:error, _} = error -> error
    end
  end

  @spec comment(integer()) :: T.domain_res(Comment.t())
  def comment(comment_id) do
    with {:ok, comment} <- ORM.find(Comment, comment_id, preload: :author) do
      ORM.fill_meta(comment)
    end
  end

  @spec full_comment(integer()) :: T.domain_res(T.article_info())
  def full_comment(comment_id) do
    get_full_comment(comment_id)
  end

  @spec get(Ecto.Queryable.t(), T.id()) :: T.domain_res(term())
  def get(queryable, id), do: ORM.find(queryable, id)

  @spec get(Ecto.Queryable.t(), T.id(), keyword()) :: T.domain_res(term())
  def get(queryable, id, preload: preload), do: ORM.find(queryable, id, preload: preload)

  @spec get_by(Ecto.Queryable.t(), map()) :: T.domain_res(term())
  def get_by(queryable, clauses), do: ORM.find_by(queryable, clauses)

  @spec get_by(Ecto.Queryable.t(), map(), keyword()) :: T.domain_res(term())
  def get_by(queryable, clauses, preload: preload),
    do: ORM.find_by(queryable, clauses, preload: preload)

  @spec preload_author(Comment.t() | map()) :: {:ok, Comment.t() | map()} | {:error, map()}
  def preload_author(%Comment{} = comment), do: Repo.preload(comment, :author) |> done

  def preload_author(article) do
    case article do
      %{author: %Ecto.Association.NotLoaded{}} ->
        Repo.preload(article, author: :user)

      %{author: %{user: %Ecto.Association.NotLoaded{}}} ->
        Repo.preload(article, author: :user)

      %{author: nil} ->
        article

      %{author: %{user: _}} ->
        article

      _ ->
        Repo.preload(article, author: :user)
    end
    |> done
  end

  @doc "get author of article or comment"
  @spec author_of(Comment.t()) :: {:ok, map()} | {:error, map()}
  def author_of(%Comment{} = comment) do
    case Ecto.assoc_loaded?(comment.author) do
      true -> comment.author
      false -> Repo.preload(comment, :author) |> Map.get(:author)
    end
    |> done
  end

  @spec author_of(map()) :: {:ok, User.t()} | {:error, map()}
  def author_of(article) do
    case Ecto.assoc_loaded?(article.author) do
      true -> article.author.user
      false -> Repo.preload(article, author: :user) |> get_in([:author, :user])
    end
    |> done
  end

  @doc "get parent article of a comment"
  @spec article_of(Comment.t()) :: {:ok, map()} | {:error, map()}
  def article_of(%Comment{} = comment) do
    with {:ok, article_thread} <- thread_of(comment) do
      comment |> Repo.preload(article_thread) |> Map.get(article_thread) |> done
    end
  end

  @spec article_of(any()) :: {:error, {:custom, String.t()}}
  def article_of(_), do: {:error, {:custom, "only support comment"}}

  @doc "get thread of comment or article"
  @spec thread_of(Comment.t()) :: {:ok, atom()} | {:error, map()}
  def thread_of(%Comment{thread: thread}) do
    Threads.to_atom(thread)
  end

  @spec thread_of(map()) :: {:ok, atom()} | {:error, map()}
  def thread_of(%{meta: %{thread: thread}}) do
    Threads.to_atom(thread)
  end

  @spec thread_of(any()) :: {:error, {:custom, String.t()}}
  def thread_of(_), do: {:error, {:custom, "invalid article"}}

  @doc """
  mark viewer emotions status for article or comment
  """
  @spec mark_viewer_emotion_states(map() | [map()], User.t() | nil) :: map() | [map()]
  def mark_viewer_emotion_states(paged_artiments, nil), do: paged_artiments
  def mark_viewer_emotion_states(%{entries: []} = paged_artiments, _), do: paged_artiments

  def mark_viewer_emotion_states(%{entries: entries} = artiments, %User{} = user) do
    entries =
      Enum.map(entries, fn artiment ->
        case Map.has_key?(artiment, :replies) do
          true ->
            mark_viewer_emotion_states(artiment, user)
            |> Map.put(:replies, mark_replies_emotion_states(artiment, user))

          false ->
            mark_viewer_emotion_states(artiment, user)
        end
      end)

    %{artiments | entries: entries}
  end

  @spec mark_viewer_emotion_states(Comment.t(), User.t()) :: Comment.t()
  def mark_viewer_emotion_states(%Comment{} = comment, %User{} = user) do
    do_mark_viewer_emotion_states(comment, user, @supported_comment_emotions)
  end

  @spec mark_viewer_emotion_states(map(), User.t()) :: map()
  def mark_viewer_emotion_states(article, %User{} = user) do
    do_mark_viewer_emotion_states(article, user, @supported_emotions)
  end

  defp do_mark_viewer_emotion_states(%{emotions: nil} = artiment, _user, _emotions) do
    artiment
  end

  defp do_mark_viewer_emotion_states(artiment, %User{} = user, emotions) do
    update_viewed_status =
      emotions
      |> Enum.reduce([], fn emotion, acc ->
        already_emoted = user_in_logins?(artiment.emotions[:"#{emotion}_user_logins"], user)
        acc ++ ["viewer_has_#{emotion}ed": already_emoted]
      end)
      |> Enum.into(%{})

    updated_emotions = Map.merge(artiment.emotions, update_viewed_status)

    %{artiment | emotions: updated_emotions}
  end

  defp mark_replies_emotion_states(%Comment{replies: []}, _), do: []

  defp mark_replies_emotion_states(%Comment{replies: replies}, user) do
    Enum.map(replies, fn reply_comment ->
      mark_viewer_emotion_states(reply_comment, user)
    end)
  end

  @doc """
  update emotions field for body article and comment
  """
  @spec update_emotions_field(map(), atom(), map(), User.t()) :: {:ok, map()} | {:error, map()}
  def update_emotions_field(artiment, emotion, status, user) do
    %{user_count: user_count, user_list: user_list} = status

    latest_users =
      user_list |> normalize_embed_users() |> Enum.slice(0, @max_latest_emotion_users_count)

    emotions =
      %{}
      |> Map.put(:"#{emotion}_count", user_count)
      |> Map.put(:"#{emotion}_user_logins", user_list |> Enum.map(& &1.login))
      |> Map.put(:"latest_#{emotion}_users", latest_users)

    viewer_has_mentioned = user.login in Map.get(emotions, :"#{emotion}_user_logins")
    emotions = emotions |> Map.put(:"viewer_has_#{emotion}ed", viewer_has_mentioned)

    artiment |> ORM.update_embed(:emotions, emotions)
  end

  @spec sync_embed_replies(Comment.t()) :: {:ok, Comment.t()}
  def sync_embed_replies(%Comment{reply_to_id: nil} = comment) do
    {:ok, comment}
  end

  def sync_embed_replies(%Comment{reply_to_id: reply_to_id} = comment) do
    with {:ok, parent_comment} <- ORM.find(Comment, reply_to_id),
         embed_index <- Enum.find_index(parent_comment.replies, &(&1.id == comment.id)) do
      case is_nil(embed_index) do
        true ->
          {:ok, comment}

        false ->
          replies = List.replace_at(parent_comment.replies, embed_index, comment)

          {:ok, parent_comment} = ORM.update_embed(parent_comment, :replies, [])
          {:ok, _} = ORM.update_embed(parent_comment, :replies, replies)
      end

      {:ok, comment}
    end
  end

  @doc """
  paged [reaction] users list
  """
  @spec load_reaction_users(Ecto.Queryable.t(), map(), map()) :: {:ok, map()} | {:error, map()}
  def load_reaction_users(queryable, article, filter) do
    {:ok, thread} = thread_of(article)
    %{page: page, size: size} = filter

    with {:ok, info} <- match(thread) do
      queryable
      |> where([u], field(u, ^info.foreign_key) == ^article.id)
      |> QueryBuilder.load_inner_users(filter)
      |> ORM.paginator(~m(page size)a)
      |> done()
    end
  end

  @doc """
  add or remove article's reaction users in list history
  e.g:
  add/remove user_id to upvoted_user_ids in article meta
  """
  @spec update_article_reaction_user_list(atom(), map(), User.t(), :add | :remove) ::
          {:ok, map()} | {:error, map()}
  def update_article_reaction_user_list(action, %{meta: nil} = article, %User{} = user, opt) do
    action = past_verb(action)
    cur_user_ids = []
    cur_users = []

    updated_user_ids =
      case opt do
        :add -> [user.id] ++ cur_user_ids
        :remove -> cur_user_ids -- [user.id]
      end

    updated_users =
      case opt do
        :add -> [extract_embed_user(user)] ++ cur_users
        :remove -> Enum.reject(cur_users, &user_id_match?(&1, user.id))
      end
      |> normalize_embed_users()

    meta =
      @default_article_meta
      |> Map.merge(%{"#{action}_user_ids": updated_user_ids})
      |> Map.merge(%{"latest_#{action}_users": updated_users})

    ORM.update_meta(article, meta)
  end

  def update_article_reaction_user_list(action, article, %User{} = user, opt) do
    action = past_verb(action)
    cur_user_ids = get_in(article, [:meta, :"#{action}_user_ids"])

    cur_users = get_in(article, [:meta, :"latest_#{action}_users"]) |> normalize_embed_users()

    updated_user_ids =
      case opt do
        :add -> [user.id] ++ cur_user_ids
        :remove -> cur_user_ids -- [user.id]
      end

    updated_users =
      case opt do
        :add -> [extract_embed_user(user)] ++ cur_users
        :remove -> Enum.reject(cur_users, &user_id_match?(&1, user.id))
      end
      |> normalize_embed_users()
      |> Enum.slice(0, @max_latest_upvoted_users_count)

    meta =
      article.meta
      |> Map.merge(%{"#{action}_user_ids": updated_user_ids})
      |> Map.merge(%{"latest_#{action}_users": updated_users})

    ORM.update_meta(article, meta)
  end

  @spec article(Community.t() | String.t(), atom(), integer() | String.t(), keyword()) ::
          {:ok, struct()} | {:error, map()}
  def article(community_or_slug, thread, inner_id, opts \\ [])

  def article(%Community{} = community, thread, inner_id, opts) do
    article(community.slug, thread, inner_id, opts)
  end

  def article(community_slug, thread, inner_id, opts) do
    preload = Keyword.get(opts, :preload, [])
    query = %{community_slug: community_slug, inner_id: inner_id}

    with {:ok, info} <- match(thread),
         {:ok, article} <- ORM.find_by(info.model, query, preload: preload),
         {:ok, article} <- ORM.fill_meta(article) do
      {:ok, article}
    else
      {:error, _} -> {:error, {:article_not_found, "article not found"}}
    end
  end

  @spec get_full_comment(integer()) :: T.domain_res(T.article_info())
  defp get_full_comment(comment_id) do
    query = from(c in Comment, where: c.id == ^comment_id, preload: ^@article_threads)

    with {:ok, comment} <- Repo.one(query) |> done(),
         article_thread <- find_comment_article_thread(comment) do
      do_extract_article_info(article_thread, Map.get(comment, article_thread))
    end
  end

  @spec do_extract_article_info(T.article_thread(), T.article_common()) ::
          T.domain_res(T.article_info())
  defp do_extract_article_info(thread, article) do
    with {:ok, article_with_author} <- Repo.preload(article, author: :user) |> done(),
         article_author <- get_in(article_with_author, [:author, :user]) do
      article_info = %{title: article.title, id: article.id}

      author_info = %{
        id: article_author.id,
        login: article_author.login,
        nickname: article_author.nickname
      }

      {:ok, %{thread: thread, article: article_info, author: author_info}}
    end
  end

  defp find_comment_article_thread(%Comment{} = comment) do
    @article_threads
    |> Enum.filter(&Map.get(comment, :"#{&1}_id"))
    |> List.first()
  end

  defp extract_embed_user(%User{} = user) do
    user
    |> Embeds.User.from_account_user()
    |> Map.from_struct()
  end

  defp normalize_embed_users(users) do
    users
    |> Enum.map(&Embeds.User.normalize/1)
    |> Enum.filter(&Embeds.User.valid?/1)
    |> Enum.uniq_by(&Embeds.User.uniq_key/1)
  end

  defp user_id_match?(user, user_id) do
    Map.get(user, :user_id) == user_id || Map.get(user, "user_id") == user_id
  end

  defp user_in_logins?([], _), do: false
  defp user_in_logins?(ids_list, %User{login: login}), do: Enum.member?(ids_list, login)

  defp done({:ok, _} = result), do: result
  defp done({:error, _} = result), do: result
  defp done(nil), do: {:error, :not_exist}
  defp done(result), do: {:ok, result}

  defp past_verb(word) do
    word_str = if is_atom(word), do: Atom.to_string(word), else: word

    case word_str do
      "upvote" -> "upvoted"
      _ -> "#{word_str}ed"
    end
  end
end
