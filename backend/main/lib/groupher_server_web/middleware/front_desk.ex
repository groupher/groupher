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
  alias GroupherServer.CMS.Helper.ArticlePath

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
           arguments:
             %{article_path: %{community: community, thread: thread, inner_id: inner_id}} =
               arguments
         } =
           resolution
       ) do
    case apply(FrontDesk, :article, [community_slug(community), thread, inner_id]) do
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

  defp fetch_comment_by_path(%{article: article_path} = comment_path) do
    inner_id = Map.get(comment_path, :inner_id) || Map.get(comment_path, :innerId)

    FrontDesk.comment(article_path, inner_id)
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
    Map.put(arguments, :passport_is_owner, comment.author.id == user_id)
  end

  defp maybe_put_comment_passport_is_owner(arguments, _comment, _resolution), do: arguments

  defp community_slug(%{slug: slug}) when is_binary(slug), do: slug
  defp community_slug(community) when is_binary(community), do: community
  defp community_slug(_), do: nil

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
