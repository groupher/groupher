defmodule GroupherServerWeb.Middleware.ArticleLoader do
  @moduledoc """
  Load article entity from normalized args (`community`, `thread`, `id`).

  Skip loading if article is already present in arguments.
  """

  @behaviour Absinthe.Middleware

  alias GroupherServerWeb.Middleware.FrontDesk

  def call(%{errors: errors} = resolution, _) when length(errors) > 0 do
    resolution
  end

  def call(%{arguments: %{article: %{__struct__: _}}} = resolution, _) do
    resolution
  end

  def call(resolution, _) do
    FrontDesk.call(resolution, :article)
  end
end
