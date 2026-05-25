defmodule GroupherServer.CMS.Artiment.Threads do
  @moduledoc """
  Single source of truth for thread values.

  Internal business values stay as lowercase atoms:
    [:post, :blog, :about]

  Absinthe exposes POST / BLOG / ABOUT by default and maps them back to the
  same lowercase atoms automatically.
  """

  @article_values Application.compile_env(:groupher_server, :article, [])
                  |> Keyword.get(:threads, [])

  @values (@article_values ++ [:kanban, :account, :about, :dashboard, :user])
          |> Enum.uniq()

  defmacro values, do: @values
  defmacro article_values, do: @article_values

  def enums, do: @values
  def article_enums, do: @article_values
  def article_values_list, do: @article_values

  def to_atom(value) when is_atom(value) and value in @values, do: {:ok, value}

  def to_atom(_), do: {:error, {:custom, "invalid thread"}}
end
