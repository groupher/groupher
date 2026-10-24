defmodule GroupherServer.ErrorCat.Registry do
  @moduledoc """
  Internal runtime lookup and flattening for registered ErrorCat catalogs.

  Catalog list -> namespace/reason lookup -> structured error metadata.

  `GroupherServer.ErrorCat.Workflow` is the supported lookup API. This module
  is the small registry primitive used by Workflow and Validator.
  """

  @doc false
  @spec find([module()], tuple(), atom()) :: map() | nil
  def find(catalogs, namespace, reason) do
    Enum.find_value(catalogs, fn catalog ->
      if catalog.namespace() == namespace do
        Enum.find(catalog.entries(), &(&1.reason == reason))
      end
    end)
  end

  @doc false
  @spec all_entries([module()]) :: [map()]
  def all_entries(catalogs) do
    for catalog <- catalogs, entry <- catalog.entries() do
      Map.put(entry, :namespace, catalog.namespace())
    end
  end
end
