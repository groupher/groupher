defmodule GroupherServer.CMS.SearchArtiments.Disabled do
  @moduledoc """
  Explicit operational opt-out for installations without a search provider.

  Queries fail visibly; indexing intents are acknowledged as disabled without
  making external requests. Re-enabling requires a complete index rebuild.
  """
  @behaviour GroupherServer.CMS.SearchArtiments.PlatformAdapter

  @impl true
  def search(_query) do
    {:error, GroupherServer.CMS.ErrorCat.custom("Article search is disabled")}
  end

  @impl true
  def upsert(_artiments, _opts), do: {:ok, :search_disabled}

  @impl true
  def delete(_refs), do: {:ok, :search_disabled}

  @impl true
  def update_metrics(_updates), do: {:ok, :search_disabled}
end
