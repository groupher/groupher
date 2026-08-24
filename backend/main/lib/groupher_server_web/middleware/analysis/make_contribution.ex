# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.Analysis.MakeContribution do
  @moduledoc """
  Refreshes contribution analytics after a successful GraphQL field resolves.

      resolver result
          |
          v
      MakeContribution
          |
          +--> Analysis.make_contribution(user)
          +--> Analysis.make_contribution(community)

  The middleware is side-effect only and leaves the Absinthe resolution value
  unchanged.
  """

  @behaviour Absinthe.Middleware
  # google: must appear in the GROUP BY clause or be used in an aggregate function
  alias GroupherServer.Analysis

  alias GroupherServer.Accounts.Model.User

  def call(%{errors: errors} = resolution, _) when errors != [], do: resolution

  def call(%{value: nil, errors: _} = resolution, _), do: resolution

  def call(
        %{arguments: arguments, context: %{cur_user: cur_user}} = resolution,
        for: threads
      ) do
    case is_list(threads) do
      true ->
        if :user in threads, do: Analysis.make_contribution(%User{id: cur_user.id})

        if :community in threads,
          do: Analysis.make_contribution(arguments.community)

      false ->
        if :user == threads, do: Analysis.make_contribution(%User{id: cur_user.id})

        if :community == threads,
          do: Analysis.make_contribution(arguments.community)
    end

    resolution
  end

  def call(resolution, _), do: resolution
end
