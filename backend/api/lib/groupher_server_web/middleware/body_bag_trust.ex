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

  See `docs/content-import/article-publish-import-refactor.md` for publisher trust boundaries.
  """

  @behaviour Absinthe.Middleware

  alias GroupherServerWeb.ErrorCat, as: WebErrorCat
  alias GroupherServerWeb.ErrorResponse

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
    ErrorResponse.put_error(resolution, service_error(code, message))
  end

  defp service_error(code, message) do
    cond do
      code == GroupherServer.Auth.contract_service_scope_forbidden() ->
        WebErrorCat.service_scope_forbidden(message)

      code == GroupherServer.Auth.contract_service_jwks_unavailable() ->
        WebErrorCat.jwks_unavailable(message)

      true ->
        WebErrorCat.invalid_service_token(message)
    end
  end
end
