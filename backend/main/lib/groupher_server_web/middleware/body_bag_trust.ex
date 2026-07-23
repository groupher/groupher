defmodule GroupherServerWeb.Middleware.BodyBagTrust do
  @moduledoc """
  Requires trusted-server proof whenever a GraphQL mutation carries a BodyBag.

  Metadata-only Article updates remain regular authenticated GraphQL requests;
  only server-derived document fields require this additional trust boundary.

      GraphQL mutation
           |
           +-- no BodyBag ----------> continue
           |
           `-- BodyBag + trusted? --+-> continue
                                    `-> reject

  See `docs/bulk-import/article-publish-import-refactor.md` for publisher trust boundaries.
  """

  @behaviour Absinthe.Middleware

  import Helper.ErrorCode
  import Helper.Utils, only: [handle_absinthe_error: 3]

  @doc "Allows ordinary mutations and requires server trust whenever body_bag is present."
  @impl Absinthe.Middleware
  def call(
        %{arguments: %{body_bag: _}, context: %{server_trusted: true}} = resolution,
        _opts
      ),
      do: resolution

  def call(%{arguments: %{body_bag: _}} = resolution, _opts) do
    handle_absinthe_error(
      resolution,
      "BodyBag requires a trusted Groupher server",
      ecode(:server_trust)
    )
  end

  def call(resolution, _opts), do: resolution
end
