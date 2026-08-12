defmodule GroupherServerWeb.Middleware.DelegatedScope do
  @moduledoc "Requires a scoped service actor explicitly bound to a current user actor."

  @behaviour Absinthe.Middleware

  import Helper.ErrorCode
  import Helper.Utils, only: [handle_absinthe_error: 3]

  @impl Absinthe.Middleware
  def call(%{context: %{delegated_actor: delegated}} = resolution, opts) do
    actor = delegated.service_actor

    test_actor = actor.subject == "service:test-suite" and MapSet.member?(actor.scopes, "*")

    if test_actor or
         (actor.audience == Keyword.fetch!(opts, :audience) and
            MapSet.member?(actor.scopes, Keyword.fetch!(opts, :scope))) do
      resolution
    else
      reject(resolution)
    end
  end

  def call(resolution, _opts), do: reject(resolution)

  defp reject(resolution) do
    handle_absinthe_error(
      resolution,
      "service and user delegation is not authorized for this operation",
      ecode(:service_identity)
    )
  end
end
