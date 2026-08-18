defmodule GroupherServer.CMS.Artiment.Threads do
  @moduledoc """
  Single source of truth for thread values.

  Internal business values stay as lowercase atoms:
    [:post, :blog, :about]

  Absinthe exposes POST / BLOG / ABOUT by default and maps them back to the
  same lowercase atoms automatically.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Threads
        -> Repo / domain event
  """

  alias GroupherServer.CMS.Artiment.Config

  @article_values Config.threads()

  @values (@article_values ++ [:kanban, :account, :about, :dashboard, :user])
          |> Enum.uniq()

  @doc "Expands the full thread atom list at compile time for Absinthe enum declarations."
  defmacro values, do: @values

  @doc "Expands the article-only thread atoms at compile time for Absinthe enum declarations."
  defmacro article_values, do: @article_values

  @doc "Returns the full thread atom list for runtime validation."
  def enums, do: @values

  @doc "Returns the article-only thread atoms for runtime validation."
  def article_enums, do: @article_values

  @doc "Returns the article-only thread atoms as a list for Ecto enum fields."
  def article_values_list, do: @article_values

  @doc """
  Normalizes a thread value into the canonical thread atom.

  ## Examples

      Threads.to_atom(:post)
      #=> {:ok, :post}

      Threads.to_atom(:unknown)
      #=> {:error, {:custom, "invalid thread"}}

  """
  def to_atom(value) when is_atom(value) and value in @values, do: {:ok, value}

  def to_atom(_), do: {:error, {:custom, "invalid thread"}}
end
