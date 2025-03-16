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

  def call(
        %{context: _, arguments: %{community: slug} = arguments} = resolution,
        :community
      ) do
    case FrontDesk.info(:community, slug) do
      {:ok, community} ->
        %{resolution | arguments: Map.put(arguments, :community, community)}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end

  def call(
        %{
          context: _,
          arguments: %{community: community, thread: thread, id: inner_id} = arguments
        } = resolution,
        :article
      ) do
    case FrontDesk.info(:article, community.slug, thread, inner_id) do
      {:ok, article} ->
        %{resolution | arguments: Map.put(arguments, :article, article)}

      {:error, err_msg} ->
        resolution |> handle_absinthe_error(err_msg, ecode(:not_exist))
    end
  end

  def call(resolution, _), do: resolution
end
