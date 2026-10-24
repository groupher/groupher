# ---
# Absinthe.Middleware behaviour
# ---
defmodule GroupherServerWeb.Middleware.FrontDesk do
  @moduledoc """
  Resolves public GraphQL references into domain models before a resolver runs.

  It loads community, account, article, or comment records and enriches resolver
  arguments with ownership flags so resolvers do not duplicate lookup logic. The
  `:article_editor` variant stores the selected Draft/Public editor head under
  `arguments.article` before the resolver runs.

  Business position:

      GraphQL arguments
        -> FrontDesk public-ref lookup
        -> loaded resolver arguments
        -> domain resolver
  """

  @behaviour Absinthe.Middleware

  require GroupherServer.CMS.ErrorCat

  alias GroupherServer.{Accounts, CMS, ErrorCat, FrontDesk}
  alias GroupherServerWeb.ErrorResponse

  alias Accounts.Model.User

  alias CMS.ErrorCat, as: CmsErrorCat
  alias CMS.Model.{Comment, Community}

  def call(%{errors: errors} = resolution, _) when errors != [] do
    resolution
  end

  def call(%{arguments: %{community: slug}} = resolution, :community) do
    fetch_community(resolution, slug)
  end

  def call(resolution, target_community: slug) when is_atom(slug) do
    fetch_community(resolution, to_string(slug), :target_community)
  end

  def call(%{arguments: %{target_community: slug}} = resolution, :target_community) do
    fetch_community(resolution, slug, :target_community)
  end

  def call(%{arguments: %{article: %{__struct__: _}}} = resolution, {:article, _}), do: resolution

  def call(%{arguments: %{article: %{__struct__: _}}} = resolution, :article), do: resolution

  def call(resolution, {:article, opts}), do: fetch_article(resolution, List.wrap(opts))

  def call(resolution, :article), do: fetch_article(resolution, [])

  def call(resolution, {:article_editor, opts}) do
    fetch_article_editor(resolution, List.wrap(opts))
  end

  def call(resolution, :comment), do: fetch_comment(resolution)

  def call(resolution, {:user, opts}), do: fetch_user(resolution, List.wrap(opts))

  def call(resolution, :user), do: fetch_user(resolution, [])

  def call(resolution, :users), do: fetch_users(resolution)

  def call(resolution, _), do: resolution

  defp fetch_community(%{arguments: arguments} = resolution, slug, community_key \\ :community) do
    case FrontDesk.community(slug) do
      {:ok, community} ->
        %{resolution | arguments: Map.put(arguments, community_key, community)}

      {:error, err_msg} ->
        put_lookup_error(resolution, err_msg, &CMS.communities_error_cat_not_exist/1)
    end
  end

  defp fetch_article(%{arguments: arguments} = resolution, opts) do
    case CMS.parse_article_arguments(arguments, opts) do
      {:ok, arguments} ->
        do_fetch_article(%{resolution | arguments: arguments}, opts)

      {:error, CmsErrorCat.error_pattern(reason: :invalid_article_path)} ->
        ErrorResponse.put_error(
          resolution,
          CMS.error_cat_invalid_article_path("invalid article input")
        )
    end
  end

  defp do_fetch_article(
         %{
           arguments: %{article_path: article_path} = arguments
         } =
           resolution,
         opts
       ) do
    actor = Map.get(resolution.context, :cur_user)

    case FrontDesk.article(article_path, actor, opts) do
      {:ok, article} ->
        updated_arguments =
          arguments
          |> Map.put(:article, article)
          |> maybe_put_article_passport_is_owner(article, resolution)

        %{resolution | arguments: updated_arguments}

      {:error, err_msg} ->
        put_lookup_error(resolution, err_msg, &CMS.articles_error_cat_not_exist/1)
    end
  end

  defp fetch_article_editor(
         %{
           arguments: %{community: %Community{} = community, id: article_id} = arguments
         } = resolution,
         opts
       ) do
    with {:ok, thread} <- Keyword.fetch(opts, :thread),
         {:ok, article, branch_id} <- fetch_editor_article(community, thread, article_id) do
      updated_arguments =
        arguments
        |> Map.put(:article, article)
        |> maybe_put_branch_id(branch_id)
        |> maybe_put_article_passport_is_owner(article, resolution)

      %{resolution | arguments: updated_arguments}
    else
      :error ->
        ErrorResponse.put_error(
          resolution,
          CMS.error_cat_missing_thread("article editor thread is required")
        )

      {:error, err_msg} ->
        put_lookup_error(resolution, err_msg, &CMS.articles_error_cat_not_exist/1)
    end
  end

  defp fetch_editor_article(%Community{id: community_id} = community, :doc, article_id) do
    with {:ok, %CMS.Model.Article{thread: :doc} = article} <-
           FrontDesk.article(article_id, mode: :internal, view: :with_author),
         {:ok, %{community: %Community{id: ^community_id}}} <-
           GroupherServer.CMS.articles_bindings_get(%{article_id: article.id}, community),
         {:ok, branch} <- CMS.docs_branch_resolve(community, nil) do
      {:ok, article, branch.id}
    else
      _ -> {:error, GroupherServer.CMS.articles_error_cat_not_exist("stable Doc not found")}
    end
  end

  defp fetch_editor_article(%Community{} = community, thread, article_id) do
    case FrontDesk.article(article_id, mode: :internal, view: :with_author) do
      {:ok, %CMS.Model.Article{thread: ^thread} = article} ->
        case GroupherServer.CMS.articles_bindings_get(%{article_id: article.id}, community) do
          {:ok, _context} ->
            {:ok, article, nil}

          _ ->
            {:error, GroupherServer.CMS.articles_error_cat_not_exist("stable Article not found")}
        end

      _ ->
        {:error, GroupherServer.CMS.articles_error_cat_not_exist("stable Article not found")}
    end
  end

  defp maybe_put_branch_id(arguments, nil), do: arguments
  defp maybe_put_branch_id(arguments, branch_id), do: Map.put(arguments, :branch_id, branch_id)

  defp fetch_comment(%{arguments: %{comment: comment_path} = arguments} = resolution) do
    case fetch_comment_by_path(comment_path) do
      {:ok, comment} ->
        updated_arguments =
          arguments
          |> Map.put(:comment, comment)
          |> Map.put(:comment_path, comment_path)
          |> maybe_put_comment_passport_is_owner(comment, resolution)

        %{resolution | arguments: updated_arguments}

      {:error, err_msg} ->
        put_lookup_error(resolution, err_msg, &CMS.comments_error_cat_not_exist/1)
    end
  end

  defp fetch_comment_by_path(%{article: _article_path} = comment_path) do
    FrontDesk.comment(comment_path)
  end

  defp maybe_put_article_passport_is_owner(arguments, article, %{
         context: %{cur_user: %{id: user_id}}
       }) do
    author_id =
      case article.author do
        %{user: %{id: id}} -> id
        %{id: id} -> id
        _ -> nil
      end

    Map.put(arguments, :passport_is_owner, author_id == user_id)
  end

  defp maybe_put_article_passport_is_owner(arguments, _article, _resolution), do: arguments

  defp maybe_put_comment_passport_is_owner(arguments, comment, %{
         context: %{cur_user: %{id: user_id}}
       }) do
    Map.put(arguments, :passport_is_owner, comment_owner?(comment, user_id))
  end

  defp maybe_put_comment_passport_is_owner(arguments, _comment, _resolution), do: arguments

  defp comment_owner?(%Comment{author: %User{id: author_id}}, user_id), do: author_id == user_id

  defp comment_owner?(_, _), do: false

  defp fetch_user(%{arguments: %{user: %User{}}} = resolution, _opts), do: resolution

  defp fetch_user(%{arguments: %{login: login}} = resolution, _opts) when is_binary(login) do
    do_fetch_user(resolution, login)
  end

  defp fetch_user(%{arguments: %{login: nil}} = resolution, opts) do
    maybe_skip_optional_user(resolution, opts)
  end

  defp fetch_user(%{arguments: %{user: login}} = resolution, _opts) when is_binary(login) do
    do_fetch_user(resolution, login)
  end

  defp fetch_user(%{arguments: %{user: nil}} = resolution, opts) do
    maybe_skip_optional_user(resolution, opts)
  end

  defp fetch_user(resolution, opts), do: maybe_skip_optional_user(resolution, opts)

  defp do_fetch_user(%{arguments: arguments} = resolution, login) do
    case FrontDesk.user(login) do
      {:ok, user} ->
        %{resolution | arguments: Map.put(arguments, :user, user)}

      {:error, err_msg} ->
        put_lookup_error(resolution, err_msg, &Accounts.profiles_error_cat_not_exist/1)
    end
  end

  defp maybe_skip_optional_user(resolution, opts) do
    if Keyword.get(opts, :optional, false) do
      resolution
    else
      ErrorResponse.put_error(
        resolution,
        GroupherServer.Accounts.profiles_error_cat_not_exist("user not found")
      )
    end
  end

  defp fetch_users(%{arguments: %{users: users} = arguments} = resolution) when is_list(users) do
    case load_users(users) do
      {:ok, users} ->
        %{resolution | arguments: Map.put(arguments, :users, users)}

      {:error, err_msg} ->
        put_lookup_error(resolution, err_msg, &Accounts.profiles_error_cat_not_exist/1)
    end
  end

  defp fetch_users(resolution) do
    ErrorResponse.put_error(
      resolution,
      GroupherServer.Accounts.profiles_error_cat_not_exist("users not found")
    )
  end

  defp load_users(users) do
    users =
      users
      |> Enum.uniq()
      |> Enum.reduce_while({:ok, []}, fn user_or_login, {:ok, users} ->
        case load_user(user_or_login) do
          {:ok, user} -> {:cont, {:ok, [user | users]}}
          {:error, err_msg} -> {:halt, {:error, err_msg}}
        end
      end)

    case users do
      {:ok, users} -> {:ok, Enum.reverse(users)}
      {:error, err_msg} -> {:error, err_msg}
    end
  end

  defp load_user(%User{} = user), do: {:ok, user}

  defp load_user(login) when is_binary(login), do: FrontDesk.user(login)

  defp load_user(_), do: {:error, "user not found"}

  defp put_lookup_error(resolution, %ErrorCat.Error{} = error, _fallback) do
    ErrorResponse.put_error(resolution, error)
  end

  defp put_lookup_error(resolution, details, fallback) do
    ErrorResponse.put_error(resolution, fallback.(error_details(details)))
  end

  defp error_details(details) when is_binary(details), do: details
  defp error_details(_), do: nil
end
