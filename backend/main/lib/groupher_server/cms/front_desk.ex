defmodule GroupherServer.CMS.FrontDesk do
  @moduledoc """
  CMS domain front desk for reading/fetching and helper operations.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> FrontDesk
        -> Repo / external boundary
  """
  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher
  import ShortMaps

  alias GroupherServer.{Accounts, CMS, Repo}
  alias GroupherServer.FrontDesk, as: RootFrontDesk

  alias Accounts.Model.User
  alias CMS.Docs.Branch
  alias CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias CMS.Gate.Context.Scope.Community, as: CommunityScope
  alias CMS.Gate.Context.Scope.Doc, as: DocScope
  alias CMS.Artiment.Threads
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Comments.Replies
  alias CMS.Comments.ErrorCat, as: CommentErrorCat
  alias CMS.Helper.ArticlePath
  alias CMS.Model.{Comment, Community, CommunityTag}
  alias CMS.Interactions.State
  alias Helper.{ORM, QueryBuilder, T}

  @threads GroupherServer.CMS.Artiment.Config.threads()

  @spec community(String.t()) :: {:ok, Community.t()} | {:error, map()}
  @doc "Runs `community` through the public `FrontDesk` boundary."
  def community(slug) when is_binary(slug) do
    CMS.Gate.scope(Community, nil, :read, CommunityScope.public())
    |> where([c], c.slug == ^slug or c.aka == ^slug)
    |> preload(:dashboard)
    |> preload(:lifecycle)
    |> preload(moderators: [:community, :user])
    |> Repo.one()
    |> done()
    |> case do
      {:ok, community} -> ORM.fill_meta(community)
      {:error, _} = error -> error
    end
  end

  @spec live_user(String.t(), keyword()) :: {:ok, User.t()} | {:error, any()}
  @doc "Runs `live_user` through the public `FrontDesk` boundary."
  def live_user(login, opts \\ []) when is_binary(login), do: RootFrontDesk.live_user(login, opts)

  @spec revalidate_user(String.t()) :: {:ok, User.t()} | {:error, any()}
  @doc "Runs `revalidate_user` through the public `FrontDesk` boundary."
  def revalidate_user(login) when is_binary(login), do: RootFrontDesk.revalidate().user(login)

  @spec comment(map()) :: T.domain_res(Comment.t())
  @doc "Runs `comment` through the public `FrontDesk` boundary."
  def comment(%{} = comment_path), do: comment(comment_path, [])

  @spec comment(integer()) :: T.domain_res(Comment.t())
  def comment(comment_id) do
    with {:ok, comment} <- ORM.find(Comment, comment_id, preload: :author) do
      ORM.fill_meta(comment)
    end
  end

  @spec comment(map(), keyword()) :: T.domain_res(Comment.t())
  def comment(%{} = comment_path, opts) when is_list(opts) do
    with {:ok, article_path, inner_id} <- parse_comment_path(comment_path) do
      comment(article_path, inner_id, opts)
    end
  end

  @spec comment(map(), integer() | String.t()) :: T.domain_res(Comment.t())
  def comment(%{} = article_path, inner_id), do: comment(article_path, inner_id, [])

  @spec comment(map(), integer() | String.t(), keyword()) :: T.domain_res(Comment.t())
  def comment(%{} = article_path, inner_id, opts) do
    preload = Keyword.get(opts, :preload, :author)

    with {:ok, %{community: community, thread: thread, inner_id: article_inner_id}} <-
           ArticlePath.parse(article_path),
         {:ok, community} <- community(community),
         {:ok, inner_id} <- parse_comment_inner_id(inner_id),
         {:ok, article} <- article(community, thread, article_inner_id),
         {:ok, info} <- match(thread),
         query <- %{thread: thread, inner_id: inner_id} |> Map.put(info.foreign_key, article.id),
         {:ok, comment} <- ORM.find_by(Comment, query, preload: preload) do
      ORM.fill_meta(comment)
    end
  end

  @spec community_tag(T.id()) :: T.domain_res(CommunityTag.t())
  @doc "Runs `community_tag` through the public `FrontDesk` boundary."
  def community_tag(id), do: ORM.find(CommunityTag, id)

  @spec community_tag(String.t(), atom(), String.t()) :: T.domain_res(CommunityTag.t())
  def community_tag(community, thread, slug) do
    with {:ok, community} <- community(community) do
      ORM.find_by(CommunityTag, community_id: community.id, thread: thread, slug: slug)
    end
  end

  @spec community_tags([T.id()]) :: T.domain_res([CommunityTag.t()])
  @doc "Runs `community_tags` through the public `FrontDesk` boundary."
  def community_tags(tag_ids) when is_list(tag_ids) do
    pos =
      tag_ids
      |> Enum.with_index()
      |> Map.new(fn {id, idx} -> {to_string(id), idx} end)

    CommunityTag
    |> where([t], t.id in ^tag_ids)
    |> Repo.all()
    |> Enum.sort_by(&Map.get(pos, to_string(&1.id), 9_999_999))
    |> done()
  end

  @spec full_comment(integer()) :: T.domain_res(T.article_info())
  @doc "Runs `full_comment` through the public `FrontDesk` boundary."
  def full_comment(comment_id) do
    get_full_comment(comment_id)
  end

  @spec get(Ecto.Queryable.t(), T.id()) :: T.domain_res(term())
  @doc "Runs `get` through the public `FrontDesk` boundary."
  def get(queryable, id), do: ORM.find(queryable, id)

  @spec get(Ecto.Queryable.t(), T.id(), keyword()) :: T.domain_res(term())
  def get(queryable, id, preload: preload), do: ORM.find(queryable, id, preload: preload)

  @spec get_by(Ecto.Queryable.t(), map()) :: T.domain_res(term())
  @doc "Returns by through the `FrontDesk` boundary."
  def get_by(queryable, clauses), do: ORM.find_by(queryable, clauses)

  @spec get_by(Ecto.Queryable.t(), map(), keyword()) :: T.domain_res(term())
  def get_by(queryable, clauses, preload: preload),
    do: ORM.find_by(queryable, clauses, preload: preload)

  @spec preload_author(Comment.t() | map()) :: {:ok, Comment.t() | map()} | {:error, map()}
  @doc "Runs `preload_author` through the public `FrontDesk` boundary."
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
  @spec article_of(Comment.t(), keyword()) :: {:ok, map()} | {:error, map()}
  def article_of(comment, opts \\ [])

  def article_of(%Comment{} = comment, opts) when is_list(opts) do
    preload = Keyword.get(opts, :preload, [])

    with {:ok, thread} <- thread_of(comment),
         {:ok, info} <- match(thread),
         article_id when not is_nil(article_id) <- Map.get(comment, info.foreign_key),
         {:ok, article} <- get(info.model, article_id, preload: preload) do
      {:ok, article}
    else
      nil -> {:error, GroupherServer.ErrorCat.custom("invalid article")}
      {:error, _} = error -> error
    end
  end

  def article_of(_, _opts), do: {:error, GroupherServer.ErrorCat.custom("only support comment")}

  @doc "get thread of comment or article"
  @spec thread_of(Comment.t()) :: {:ok, atom()} | {:error, map()}
  def thread_of(%Comment{thread: thread}) when is_atom(thread) and not is_nil(thread) do
    Threads.to_atom(thread)
  end

  @spec thread_of(map()) :: {:ok, atom()} | {:error, map()}
  def thread_of(%{meta: %{thread: thread}}) when is_atom(thread) and not is_nil(thread) do
    Threads.to_atom(thread)
  end

  @spec thread_of(any()) :: {:error, GroupherServer.ErrorCat.custom(String.t())}
  def thread_of(_), do: {:error, GroupherServer.ErrorCat.custom("invalid article")}

  @spec sync_embed_replies(Comment.t()) :: {:ok, Comment.t()}
  @doc "Synchronizes embed replies through the `FrontDesk` boundary."
  def sync_embed_replies(%Comment{reply_to_comment_id: nil} = comment) do
    {:ok, comment}
  end

  def sync_embed_replies(%Comment{} = comment) do
    with %Comment{} = parent_comment <- Replies.root_comment(comment),
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

  @spec article(ArticlePath.t(), keyword()) :: {:ok, struct()} | {:error, map()}
  @doc "Runs `article` through the public `FrontDesk` boundary."
  def article(%{} = article_path, opts \\ []) do
    with {:ok, %{community: community, thread: thread, inner_id: inner_id}} <-
           ArticlePath.parse(article_path),
         {:ok, community} <- community(community) do
      article(community, thread, inner_id, opts)
    end
  end

  @spec article(Community.t(), atom(), integer() | String.t(), keyword()) ::
          {:ok, struct()} | {:error, map()}
  def article(community, thread, inner_id, opts \\ [])

  def article(%Community{id: community_id} = community, thread, inner_id, opts) do
    preload = Keyword.get(opts, :preload, [])

    with {:ok, info} <- match(thread),
         {:ok, scope_context} <- public_scope_context(community, thread, opts),
         %Ecto.Query{} = query <-
           CMS.Gate.scope(info.model, nil, :read, scope_context),
         {:ok, article} <-
           query
           |> where(
             [article],
             article.community_id == ^community_id and article.inner_id == ^inner_id
           )
           |> preload(^preload)
           |> Repo.one()
           |> done(),
         {:ok, article} <- ORM.fill_meta(article) do
      {:ok, State.read(article)}
    else
      {:error, _} -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp public_scope_context(%Community{} = community, :doc, opts) do
    with {:ok, branch} <- Branch.resolve(community, Branch.main_slug()) do
      {:ok,
       DocScope.public_branch(branch.id,
         include_illegal: Keyword.get(opts, :include_illegal, false)
       )}
    end
  end

  defp public_scope_context(_community, thread, opts),
    do:
      {:ok,
       ArticleScope.public(thread, include_illegal: Keyword.get(opts, :include_illegal, false))}

  defp parse_comment_inner_id(value) when is_integer(value) and value >= 0, do: {:ok, value}

  defp parse_comment_inner_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} when int >= 0 -> {:ok, int}
      _ -> {:error, CommentErrorCat.not_exist("comment not found")}
    end
  end

  defp parse_comment_inner_id(_), do: {:error, CommentErrorCat.not_exist("comment not found")}

  defp parse_comment_path(%{article: article_path, inner_id: inner_id}) do
    {:ok, article_path, inner_id}
  end

  defp parse_comment_path(_), do: {:error, CommentErrorCat.not_exist("comment not found")}

  @spec get_full_comment(integer()) :: T.domain_res(T.article_info())
  defp get_full_comment(comment_id) do
    query = from(c in Comment, where: c.id == ^comment_id, preload: ^@threads)

    with {:ok, comment} <- Repo.one(query) |> comment_done(),
         {:ok, thread} <- thread_of(comment) do
      do_extract_article_info(thread, Map.get(comment, thread))
    end
  end

  @spec do_extract_article_info(T.thread(), T.article_common()) ::
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

  defp done({:ok, _} = result), do: result
  defp done({:error, _} = result), do: result
  defp done(nil), do: {:error, GroupherServer.ErrorCat.custom(%{reason: :not_exist})}
  defp done(result), do: {:ok, result}

  defp comment_done({:ok, _} = result), do: result
  defp comment_done({:error, _} = result), do: result
  defp comment_done(nil), do: {:error, CommentErrorCat.not_exist("comment not found")}
  defp comment_done(result), do: {:ok, result}
end
