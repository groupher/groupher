defmodule GroupherServerWeb.Middleware.ServerTrust do
  @moduledoc """
  Requires proof that a GraphQL request came from a trusted Groupher server.

  User authorization remains a separate middleware concern. This middleware
  only establishes the server-to-server trust boundary.

      internal GraphQL continuation -> server_trusted? -> continue / reject

  See `docs/bulk-import/content-import-architecture.md` for Node/Phoenix trust ownership.
  """

  @behaviour Absinthe.Middleware

  import Helper.ErrorCode
  import Helper.Utils, only: [handle_absinthe_error: 3]

  @doc "Allows only GraphQL requests already marked as server trusted by the request context."
  @impl Absinthe.Middleware
  def call(%{context: %{server_trusted: true}} = resolution, _opts), do: resolution

  def call(resolution, _opts) do
    handle_absinthe_error(
      resolution,
      "request is not from a trusted Groupher server",
      ecode(:server_trust)
    )
  end
end
