defmodule GroupherServerWeb.Schema.Helper.Imports do
  @moduledoc """
  helper for import cms article related fields
  """

  import Helper.Utils, only: [get_config: 2]

  alias GroupherServerWeb.Schema.CMS

  @threads get_config(:article, :threads)
  @doc """
  import article fields based on @threads
  e.g:
  ----
  import_types(:cms_[article]_mutations)
  # ...
  """
  defmacro import_article_fields(:mutations) do
    @threads
    |> Enum.map(
      &quote do
        import_fields(unquote(:"cms_#{&1}_mutations"))
      end
    )
  end

  @doc """
  import article fields based on @threads
  e.g:
  ----
  import_types(CMS.Mutations.[Article])
  # ...
  """
  defmacro import_article_fields(:mutations, :module) do
    @threads
    |> Enum.map(
      &quote do
        import_types(unquote(Module.concat(CMS.Mutations, Recase.to_pascal(to_string(&1)))))
      end
    )
  end
end
