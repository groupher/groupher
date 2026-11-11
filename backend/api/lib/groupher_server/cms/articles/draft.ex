defmodule GroupherServer.CMS.Articles.Draft do
  @moduledoc """
  Internal facade for legacy Docs Draft storage.

      caller -> GroupherServer.CMS.Articles.Draft -> result
  """

  alias __MODULE__.Store

  defdelegate get(article), to: Store
  defdelegate get(article, opts), to: Store
  defdelegate ensure_from_public(article, author), to: Store
  defdelegate ensure_from_public(article, author, opts), to: Store
end
