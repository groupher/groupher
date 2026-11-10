defmodule GroupherServer.CMS.Articles.Draft do
  @moduledoc """
  Internal facade for Article draft storage and comparison.

      caller -> GroupherServer.CMS.Articles.Draft -> result
  """

  alias __MODULE__.{Diff, Store}

  defdelegate unpublished?(article), to: Diff
  defdelegate compare(article), to: Diff
  defdelegate get(article), to: Store
  defdelegate get(article, opts), to: Store
  defdelegate ensure_from_public(article, author), to: Store
  defdelegate ensure_from_public(article, author, opts), to: Store
end
