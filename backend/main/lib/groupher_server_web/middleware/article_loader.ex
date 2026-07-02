defmodule GroupherServerWeb.Middleware.ArticleLoader do
  @moduledoc """
  Load article entity from `arguments.article_path` or public `arguments.article`.

  This middleware may run after Passport. It repeats `ArticlePath` validation so
  thread-specific fields cannot load a different article type by changing input.
  """

  @behaviour Absinthe.Middleware

  alias GroupherServerWeb.Middleware.FrontDesk

  def call(%{errors: errors} = resolution, _) when length(errors) > 0 do
    resolution
  end

  def call(%{arguments: %{article: %{__struct__: _}}} = resolution, _) do
    resolution
  end

  def call(resolution, opts) do
    FrontDesk.call(resolution, {:article, List.wrap(opts)})
  end
end
