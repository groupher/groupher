defmodule GroupherServerWeb.Schema.Helper.Objects do
  @moduledoc """
  general fields used in schema definition
  """
  import Helper.Utils, only: [plural: 1]

  @threads GroupherServer.CMS.Artiment.Config.threads()

  @doc """
  paged articles helper

  e,g:
  object :paged_blogs do
    field(:entries, list_of(:blog))
    pagination_fields()
  end
  """
  defmacro paged_article_objects do
    @threads
    |> Enum.map(
      &quote do
        object unquote(:"paged_#{plural(&1)}") do
          field(:entries, list_of(unquote(&1)))
          pagination_fields()
        end
      end
    )
  end
end
