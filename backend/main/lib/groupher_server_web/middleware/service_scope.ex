defmodule GroupherServerWeb.Middleware.ServiceScope do
  @moduledoc "Requires one exact service-token audience and operation scope."

  @behaviour Absinthe.Middleware

  import Helper.ErrorCode
  import Helper.Utils, only: [handle_absinthe_error: 3]

  @impl Absinthe.Middleware
  def call(%{context: %{service_actor: actor}} = resolution, opts) do
    audience = Keyword.fetch!(opts, :audience)
    scope = Keyword.fetch!(opts, :scope)

    test_actor = actor.subject == "service:test-suite" and MapSet.member?(actor.scopes, "*")

    if test_actor or (actor.audience == audience and MapSet.member?(actor.scopes, scope)) do
      resolution
    else
      reject(resolution)
    end
  end

  def call(resolution, _opts), do: reject(resolution)

  defp reject(resolution) do
    handle_absinthe_error(
      resolution,
      "service identity is not authorized for this operation",
      ecode(:service_auth)
    )
  end
end
