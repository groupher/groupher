# ---
# Absinthe.Middleware behaviour
# ---
defmodule GroupherServerWeb.Middleware.FrontDesk do
  @moduledoc """
  Resolves public GraphQL references into domain models before a resolver runs.

  It loads community, account, article, or comment records and enriches resolver
  arguments with ownership flags so resolvers do not duplicate lookup logic.

  Business position:

      GraphQL arguments
        -> FrontDesk public-ref lookup
        -> loaded resolver arguments
        -> domain resolver
  """

  @behaviour Absinthe.Middleware

  import Helper.Utils, only: [handle_absinthe_error: 3]
  alias GroupherServer.ErrorCat

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias GroupherServer.{CMS, FrontDesk, Repo}
  alias GroupherServer.CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias GroupherServer.CMS.Comments.ErrorCat, as: CommentErrorCat
  alias GroupherServer.CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias GroupherServer.CMS.Helper.ArticlePath
  alias GroupherServer.CMS.Model.{Comment, Community}

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
        resolution
        |> handle_absinthe_error(
          CommunityErrorCat.not_exist(error_details(err_msg)),
          ErrorCat.code(CommunityErrorCat.not_exist())
        )
    end
  end

  defp fetch_article(%{arguments: arguments} = resolution, opts) do
    case ArticlePath.parse_arguments(arguments, opts) do
      {:ok, arguments} ->
        do_fetch_article(%{resolution | arguments: arguments}, opts)

      {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} ->
        resolution
        |> handle_absinthe_error("invalid article input", ErrorCat.code(ErrorCat.custom()))
    end
  end

  defp do_fetch_article(
         %{
           arguments: %{article_path: article_path} = arguments
         } =
           resolution,
         opts
       ) do
    preload = Keyword.get(opts, :preload, author: :user)

    case FrontDesk.article(article_path, preload: preload) do
      {:ok, article} ->
        updated_arguments =
          arguments
          |> Map.put(:article, article)
          |> maybe_put_article_passport_is_owner(article, resolution)

        %{resolution | arguments: updated_arguments}

      {:error, err_msg} ->
        resolution
        |> handle_absinthe_error(
          ArticleErrorCat.not_exist(error_details(err_msg)),
          ErrorCat.code(ArticleErrorCat.not_exist())
        )
    end
  end

  defp fetch_article_editor(
         %{
           arguments: %{community: %Community{} = community, id: article_hash_id} = arguments
         } = resolution,
         opts
       ) do
    with {:ok, thread} <- Keyword.fetch(opts, :thread),
         {:ok, article} <- CMS.Articles.read_editor(community, thread, article_hash_id) do
      article = Repo.preload(article, author: :user)

      updated_arguments =
        maybe_put_article_passport_is_owner(arguments, article, resolution)

      %{resolution | arguments: updated_arguments}
    else
      :error ->
        resolution
        |> handle_absinthe_error(
          "article editor thread is required",
          ErrorCat.code(ErrorCat.custom())
        )

      {:error, err_msg} ->
        resolution
        |> handle_absinthe_error(
          ArticleErrorCat.not_exist(error_details(err_msg)),
          ErrorCat.code(ArticleErrorCat.not_exist())
        )
    end
  end

  defp fetch_comment(%{arguments: %{comment: comment_path} = arguments} = resolution) do
    case fetch_comment_by_path(comment_path) do
      {:ok, comment} ->
        updated_arguments =
          arguments
          |> Map.put(:comment, comment)
          |> maybe_put_comment_passport_is_owner(comment, resolution)

        %{resolution | arguments: updated_arguments}

      {:error, err_msg} ->
        resolution
        |> handle_absinthe_error(
          CommentErrorCat.not_exist(error_details(err_msg)),
          ErrorCat.code(CommentErrorCat.not_exist())
        )
    end
  end

  defp fetch_comment_by_path(%{article: _article_path} = comment_path) do
    FrontDesk.comment(comment_path)
  end

  defp maybe_put_article_passport_is_owner(arguments, article, %{
         context: %{cur_user: %{id: user_id}}
       }) do
    Map.put(arguments, :passport_is_owner, article.author.user.id == user_id)
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
        resolution
        |> handle_absinthe_error(
          ProfileErrorCat.not_exist(error_details(err_msg)),
          ErrorCat.code(ProfileErrorCat.not_exist())
        )
    end
  end

  defp maybe_skip_optional_user(resolution, opts) do
    if Keyword.get(opts, :optional, false) do
      resolution
    else
      resolution
      |> handle_absinthe_error(
        "user not found",
        ErrorCat.code(ProfileErrorCat.not_exist("user not found"))
      )
    end
  end

  defp fetch_users(%{arguments: %{users: users} = arguments} = resolution) when is_list(users) do
    case load_users(users) do
      {:ok, users} ->
        %{resolution | arguments: Map.put(arguments, :users, users)}

      {:error, err_msg} ->
        resolution
        |> handle_absinthe_error(
          ProfileErrorCat.not_exist(error_details(err_msg)),
          ErrorCat.code(ProfileErrorCat.not_exist())
        )
    end
  end

  defp fetch_users(resolution),
    do:
      resolution
      |> handle_absinthe_error(
        "users not found",
        ErrorCat.code(ProfileErrorCat.not_exist("users not found"))
      )

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

  defp error_details(%ErrorCat.Error{details: %{message: message}}) when is_binary(message),
    do: message

  defp error_details(%ErrorCat.Error{details: details}) when is_binary(details), do: details
  defp error_details(details) when is_binary(details), do: details
  defp error_details(_), do: nil
end
