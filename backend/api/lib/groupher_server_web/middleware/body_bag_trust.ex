defmodule GroupherServerWeb.Middleware.BodyBagTrust do
  @moduledoc """
  Requires a scoped service actor whenever a GraphQL mutation carries a BodyBag.

  Metadata-only Article updates remain regular authenticated GraphQL requests;
  only server-derived document fields require this additional trust boundary.

      GraphQL mutation
           |
           +-- no BodyBag ----------> continue
           |
           `-- BodyBag + trusted? --+-> continue
                                    `-> reject

  See `docs/import/article-publish-import-refactor.md` for publisher trust boundaries.
  """

  @behaviour Absinthe.Middleware

  import Helper.Utils, only: [handle_absinthe_error: 3]

  @doc "Allows ordinary mutations and requires a bounded publisher scope for BodyBag writes."
  @impl Absinthe.Middleware
  def call(
        %{arguments: %{body_bag: _}, context: %{service_actor: actor}} = resolution,
        opts
      ) do
    scope = Keyword.fetch!(opts, :scope)

    allowed =
      (actor.subject == "service:test-suite" and MapSet.member?(actor.scopes, "*")) or
        (actor.audience == "phoenix:content-publisher-api" and MapSet.member?(actor.scopes, scope))

    if allowed do
      resolution
    else
      reject(
        resolution,
        "BodyBag requires the Content Publisher audience and mutation capability",
        GroupherServer.Auth.contract_service_scope_forbidden()
      )
    end
  end

  def call(
        %{arguments: %{body_bag: _}, context: %{service_auth_failure: code}} = resolution,
        _opts
      ) do
    reject(resolution, "BodyBag publisher identity could not be verified", code)
  end

  def call(%{arguments: %{body_bag: _}} = resolution, _opts) do
    reject(
      resolution,
      "BodyBag requires an authorized Groupher publisher service",
      GroupherServer.Auth.contract_service_token_invalid()
    )
  end

  def call(resolution, _opts), do: resolution

  defp reject(resolution, message, code) do
    handle_absinthe_error(resolution, message, code)
  end
end
