# ---
# Absinthe.Middleware behaviour
# ---
defmodule GroupherServerWeb.Middleware.FrontDesk do
  @moduledoc """
  fetch full community/account model info based on query args front GraphQL endpoint
  """

  @behaviour Absinthe.Middleware

  import Helper.Utils, only: [handle_absinthe_error: 3]
  import Helper.ErrorCode

  alias GroupherServer.FrontDesk
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Helper.ArticlePath
  alias GroupherServer.CMS.Model.Comment

  def call(%{errors: errors} = resolution, _) when length(errors) > 0 do
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

  def call(resolution, :comment), do: fetch_comment(resolution)

  def call(resolution, :user), do: fetch_user(resolution)

  def call(resolution, _), do: resolution

  defp fetch_community(%{arguments: arguments} = resolution, slug, community_key \\ :community) do
    case FrontDesk.community(slug) do
      {:ok, community} ->
        %{resolution | arguments: Map.put(arguments, community_key, community)}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end

  defp fetch_article(%{arguments: arguments} = resolution, opts) do
    case ArticlePath.parse_arguments(arguments, opts) do
      {:ok, arguments} ->
        do_fetch_article(%{resolution | arguments: arguments})

      {:error, :invalid_article_path} ->
        resolution |> handle_absinthe_error("invalid article input", ecode(:custom))
    end
  end

  defp do_fetch_article(
         %{
           arguments: %{article_path: article_path} = arguments
         } =
           resolution
       ) do
    case FrontDesk.article(article_path, preload: [author: :user]) do
      {:ok, article} ->
        updated_arguments =
          arguments
          |> Map.put(:article, article)
          |> maybe_put_article_passport_is_owner(article, resolution)

        %{resolution | arguments: updated_arguments}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
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
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
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

  defp fetch_user(%{arguments: %{login: login} = arguments} = resolution) do
    case FrontDesk.user(login) do
      {:ok, user} ->
        %{resolution | arguments: Map.put(arguments, :user, user)}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end

  defp fetch_user(%{arguments: %{user: user} = arguments} = resolution) do
    case FrontDesk.user(user) do
      {:ok, user} ->
        %{resolution | arguments: Map.put(arguments, :user, user)}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end
end
