defmodule GroupherServer.ErrorCat.Registry do
  @moduledoc """
  Runtime lookup and flattening for registered ErrorCat catalogs.

  Catalog list -> namespace/reason lookup -> structured error metadata.
  """

  def find(catalogs, namespace, reason) do
    Enum.find_value(catalogs, fn catalog ->
      if catalog.namespace() == namespace do
        Enum.find(catalog.entries(), &(&1.reason == reason))
      end
    end)
  end

  def all_entries(catalogs) do
    for catalog <- catalogs, entry <- catalog.entries() do
      Map.put(entry, :namespace, catalog.namespace())
    end
  end
end
