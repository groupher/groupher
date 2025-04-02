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

  def call(%{arguments: %{community: community}} = resolution, :article)
      when is_binary(community) do
    fetch_article(resolution, community)
  end

  def call(%{arguments: %{community: community}} = resolution, :article) do
    fetch_article(resolution, community.slug)
  end

  def call(%{arguments: %{thread_id: thread_id}} = resolution, :thread) do
    fetch_thread(resolution, thread_id)
  end

  def call(%{arguments: %{user: user}} = resolution, :user) do
    fetch_user(resolution, user)
  end

  def call(resolution, _), do: resolution

  defp fetch_community(%{arguments: arguments} = resolution, slug, community_key \\ :community) do
    case FrontDesk.info(:community, slug) do
      {:ok, community} ->
        %{resolution | arguments: Map.put(arguments, community_key, community)}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end

  defp fetch_article(
         %{
           context: %{cur_user: cur_user},
           arguments: %{thread: thread, id: inner_id} = arguments
         } = resolution,
         community
       ) do
    case FrontDesk.info(:article, community, thread, inner_id) do
      {:ok, article} ->
        passport_is_owner = article.author.user.id == cur_user.id

        updated_arguments =
          arguments
          |> Map.put(:article, article)
          |> Map.put(:passport_is_owner, passport_is_owner)
          |> Map.put(:passport_community, article.original_community_slug)

        # |> Map.put(:passport_communities, [article.original_community_slug])

        %{resolution | arguments: updated_arguments}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end

  defp fetch_article(
         %{arguments: %{thread: thread, id: inner_id} = arguments} = resolution,
         community
       ) do
    case FrontDesk.info(:article, community, thread, inner_id) do
      {:ok, article} ->
        updated_arguments = arguments |> Map.put(:article, article)
        %{resolution | arguments: updated_arguments}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end

  defp fetch_thread(%{arguments: arguments} = resolution, thread_id) do
    case FrontDesk.info(:thread, thread_id) do
      {:ok, community} ->
        %{resolution | arguments: Map.put(arguments, :thread, community)}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end

  defp fetch_user(%{arguments: arguments} = resolution, user) do
    case FrontDesk.info(:user, user) do
      {:ok, user} ->
        %{resolution | arguments: Map.put(arguments, :user, user)}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end
end
