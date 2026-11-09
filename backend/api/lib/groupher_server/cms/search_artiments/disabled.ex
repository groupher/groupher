defmodule GroupherServer.CMS.SearchArtiments.Disabled do
  @moduledoc """
  Explicit operational opt-out for installations without a search provider.

  Queries fail visibly; indexing intents are acknowledged as disabled without
  making external requests. Re-enabling requires a complete index rebuild.

      CMS search / indexing -> configured Disabled adapter
                            -> search: explicit error
                            -> index writes: disabled acknowledgement, no provider I/O
  """
  alias GroupherServer.CMS
  alias CMS.ErrorCat

  @behaviour CMS.SearchArtiments.PlatformAdapter

  @impl true
  def search(_query) do
    {:error, ErrorCat.custom("Article search is disabled")}
  end

  @impl true
  def upsert(_artiments, _opts), do: {:ok, :pass}

  @impl true
  def delete(_refs), do: {:ok, :pass}

  @impl true
  def update_metrics(_updates), do: {:ok, :pass}
end
