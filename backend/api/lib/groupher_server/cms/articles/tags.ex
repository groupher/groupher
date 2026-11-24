defmodule GroupherServer.CMS.Articles.Tags do
  @moduledoc """
  Internal facade for assigning Community tags to Articles.

      caller -> GroupherServer.CMS.Articles.Tags -> result
  """

  alias __MODULE__.Assignment

  @doc "Replaces an Article's Community tag assignments through the assignment owner."
  defdelegate overwrite(community, thread, article, attrs, opts), to: Assignment
  @doc "Adds one Community tag to an Article through the assignment owner."
  defdelegate add(article, tag_id, opts), to: Assignment
  @doc "Removes one Community tag from an Article through the assignment owner."
  defdelegate remove(article, tag_id, opts), to: Assignment
end
