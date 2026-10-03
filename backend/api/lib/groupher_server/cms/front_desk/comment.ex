defmodule GroupherServer.CMS.FrontDesk.Comment do
  @moduledoc """
  Resolves public Comment paths and trusted internal Comment views for the
  CMS FrontDesk facade.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Comment
        -> FrontDesk.Article / Community / Relation
        -> Repo
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat

  alias CMS.Comments.ErrorCat, as: CommentErrorCat
  alias CMS.FrontDesk.{Article, Relation}
  alias CMS.Helper.ArticlePath
  alias CMS.Model.{ArticlePublic, Comment}
  alias CMS.Model.Article, as: ArticleModel
  alias Helper.{ORM, T}

  @doc "Reads one Comment from a structured public path."
  @spec read(map()) :: T.domain_res(Comment.t())
  def read(comment_path) when is_map(comment_path), do: read(comment_path, [])

  @doc "Reads one Comment by stable id or named internal view."
  @spec read(integer(), keyword()) :: T.domain_res(Comment.t() | map())
  def read(comment_id, opts) when is_integer(comment_id) and is_list(opts) do
    case {Keyword.get(opts, :mode, :public), Keyword.get(opts, :view, :default)} do
      {:internal, :article_context} -> full(comment_id)
      {:internal, view} when view in [:default, :with_author] -> load_internal(comment_id, view)
      _ -> {:error, CommentErrorCat.not_exist("comment not found")}
    end
  end

  @spec read(map(), keyword()) :: T.domain_res(Comment.t())
  def read(comment_path, opts) when is_map(comment_path) and is_list(opts) do
    read(comment_path, nil, opts)
  end

  @spec read(map(), term(), keyword()) :: T.domain_res(Comment.t())
  def read(%{article: _} = comment_path, actor, opts) when is_list(opts) do
    case Keyword.get(opts, :mode, :public) do
      mode when mode in [:public, :management] ->
        with {:ok, article_path, inner_id} <- parse_comment_path(comment_path) do
          read(article_path, inner_id, actor, opts)
        end

      _mode ->
        {:error, CommentErrorCat.not_exist("unsupported Comment read mode")}
    end
  end

  @doc "Reads one Comment under a structured Article path."
  @spec read(map(), integer() | String.t(), keyword()) :: T.domain_res(Comment.t())
  def read(article_path, inner_id, opts) when is_map(article_path) and is_list(opts),
    do: read(article_path, inner_id, nil, opts)

  defp load_internal(comment_id, _view) do
    with {:ok, comment} <- ORM.find(Comment, comment_id, preload: :author) do
      ORM.fill_meta(comment)
    end
  end

  @spec read(map(), integer() | String.t(), term(), keyword()) :: T.domain_res(Comment.t())
  def read(article_path, inner_id, actor, opts) do
    view = Keyword.get(opts, :view, :default)

    with {:ok, %{community: community, thread: thread, inner_id: article_inner_id}} <-
           ArticlePath.parse(article_path),
         {:ok, inner_id} <- parse_comment_inner_id(inner_id),
           {:ok, article} <-
           Article.read(
             %{community: community, thread: thread, inner_id: article_inner_id},
             actor,
             opts
           ),
         query <- stable_comment_query(article, thread, inner_id),
         {:ok, comment} <- load_public_comment(query, view) do
      ORM.fill_meta(comment)
    end
  end

  defp load_public_comment(query, view) when view in [:default, :with_author],
    do: ORM.find_by(Comment, query, preload: :author)

  defp load_public_comment(_query, _view),
    do: {:error, CommentErrorCat.not_exist("unsupported Comment read view")}

  defp stable_comment_query(%{id: article_id}, thread, inner_id) when is_binary(article_id),
    do: %{thread: thread, inner_id: inner_id, article_id: article_id}

  defp stable_comment_query(article, thread, inner_id) do
    {:ok, info} = match(thread)
    %{thread: thread, inner_id: inner_id} |> Map.put(info.foreign_key, article.id)
  end

  @doc "Returns the parent Article and author information for one Comment."
  @spec full(integer()) :: T.domain_res(T.article_info())
  def full(comment_id) do
    query =
      from(comment in Comment,
        where: comment.id == ^comment_id,
        preload: [article: [author: :user]]
      )

    with {:ok, comment} <- Repo.one(query) |> comment_done(),
         {:ok, thread} <- Relation.thread_of(comment) do
      extract_article_info(thread, comment.article)
    end
  end

  defp parse_comment_inner_id(value) when is_integer(value) and value >= 0, do: {:ok, value}

  defp parse_comment_inner_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} when int >= 0 -> {:ok, int}
      _ -> {:error, CommentErrorCat.not_exist("comment not found")}
    end
  end

  defp parse_comment_inner_id(_), do: {:error, CommentErrorCat.not_exist("comment not found")}

  defp parse_comment_path(%{article: article_path, inner_id: inner_id}),
    do: {:ok, article_path, inner_id}

  defp parse_comment_path(_), do: {:error, CommentErrorCat.not_exist("comment not found")}

  defp extract_article_info(thread, %ArticleModel{} = article) do
    public = Repo.get(ArticlePublic, article.id)
    article_author = article.author.user
    article_info = %{title: public && public.title, id: article.id}

    author_info = %{
      id: article_author.id,
      login: article_author.login,
      nickname: article_author.nickname
    }

    {:ok, %{thread: thread, article: article_info, author: author_info}}
  end

  defp extract_article_info(thread, article) do
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

  defp done(nil), do: {:error, ErrorCat.custom(%{reason: :not_exist})}
  defp done(result), do: {:ok, result}

  defp comment_done(nil), do: {:error, CommentErrorCat.not_exist("comment not found")}
  defp comment_done(result), do: {:ok, result}
end
