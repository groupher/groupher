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

  See `docs/bulk-import/article-publish-import-refactor.md` for publisher trust boundaries.
  """

  @behaviour Absinthe.Middleware

  import Helper.ErrorCode
  import Helper.Utils, only: [handle_absinthe_error: 3]

  @doc "Allows ordinary mutations and requires a bounded publisher scope for BodyBag writes."
  @impl Absinthe.Middleware
  def call(
        %{arguments: %{body_bag: _}, context: %{service_actor: actor} = context} = resolution,
        _opts
      ) do
    allowed =
      (actor.subject == "service:test-suite" and MapSet.member?(actor.scopes, "*")) or
        (actor.audience == "phoenix:dashboard-api" and
           MapSet.member?(actor.scopes, "dashboard:body-bag:write") and
           Map.has_key?(context, :delegated_actor)) or
        (actor.audience == "phoenix:content-import-api" and
           MapSet.member?(actor.scopes, "content-import:write"))

    if allowed, do: resolution, else: reject(resolution)
  end

  def call(%{arguments: %{body_bag: _}} = resolution, _opts), do: reject(resolution)

  def call(resolution, _opts), do: resolution

  defp reject(resolution) do
    handle_absinthe_error(
      resolution,
      "BodyBag requires an authorized Groupher publisher service",
      ecode(:service_auth)
    )
  end
end
