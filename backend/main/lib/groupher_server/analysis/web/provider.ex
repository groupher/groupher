defmodule GroupherServer.Analysis.Web.Provider do
  @moduledoc """
  Provider boundary for built-in Web Analysis.

  Providers return a Groupher-owned DTO. Raw vendor response fields must not
  cross this boundary.
  """

  alias GroupherServer.Analysis.Web.Community

  @doc """
  Returns the legacy summary DTO for one community and time range.

  Providers must return Groupher-owned keys, not raw vendor response payloads.
  """
  @callback summary(Community.t(), map()) :: {:ok, map()} | {:error, term()}

  @doc """
  Returns the SSR-sized v2 overview DTO seed for one community and time range.
  """
  @callback overview(Community.t(), map()) :: {:ok, map()} | {:error, term()}

  @doc "Returns one normalized page breakdown dimension."
  @callback pages(Community.t(), map(), :path | :entry | :exit | :title | :query) ::
              {:ok, list(map())} | {:error, term()}

  @doc "Returns one normalized source breakdown dimension."
  @callback sources(Community.t(), map(), :referrer | :channel | :domain) ::
              {:ok, list(map())} | {:error, term()}

  @doc "Returns one normalized environment breakdown dimension."
  @callback environment(Community.t(), map(), :browser | :os | :device | :language | :screen) ::
              {:ok, list(map())} | {:error, term()}

  @doc "Returns one normalized location breakdown dimension."
  @callback location(Community.t(), map(), :country | :region | :city) ::
              {:ok, list(map())} | {:error, term()}

  @doc "Returns normalized UTC weekly traffic cells."
  @callback traffic(Community.t(), map()) :: {:ok, map()} | {:error, term()}

  @doc """
  Creates the provider website backing one community.
  """
  @callback create_website(Community.t()) :: {:ok, String.t()} | {:error, term()}
end
