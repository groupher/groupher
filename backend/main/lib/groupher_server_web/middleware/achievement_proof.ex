# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.AchievementProof do
  @moduledoc """
  Supplies the empty achievement projection expected by GraphQL clients.

  Account reads may legitimately return no achievement row. This middleware
  converts only that `nil` value into stable zero/false fields and leaves real
  values and errors untouched.

  Business position:

      Resolver result
        -> AchievementProof middleware
        -> next middleware
        -> GraphQL field result
  """

  @behaviour Absinthe.Middleware

  @doc "Projects a missing achievement result into the public zero-value shape."
  def call(%{value: nil} = resolution, _) do
    value = %{
      reputation: 0,
      articles_upvotes_count: 0,
      articles_collects_count: 0,
      donate_member: false,
      senior_member: false,
      sponsor_member: false,
      source_contribute: %{
        web: false,
        server: false,
        weApp: false,
        h5: false,
        mobile: false
      }
    }

    %{resolution | value: value}
  end

  def call(resolution, _), do: resolution
end
