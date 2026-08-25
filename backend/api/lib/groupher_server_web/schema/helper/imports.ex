defmodule GroupherServerWeb.Schema.Helper.Imports do
  @moduledoc """
  Generates Absinthe imports for every configured CMS artiment thread.

  The macros keep the root schema aligned with `CMS.Artiment.Config.threads/0`
  so adding a thread does not require duplicating mutation-module imports.

  Business position:

      Client
        -> Absinthe schema / Imports
        -> resolver or domain context
        -> GraphQL response
  """

  alias GroupherServerWeb.Schema.CMS

  @threads GroupherServer.CMS.Artiment.Config.threads()
  @doc """
  Imports mutation fields for every configured artiment thread.

  For example:

      import_fields(:cms_post_mutations)

  The field names are generated from the canonical thread registry.
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
  Imports each thread-specific mutation module into the current schema.

  Module names are generated under `GroupherServerWeb.Schema.CMS.Mutations`.
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
