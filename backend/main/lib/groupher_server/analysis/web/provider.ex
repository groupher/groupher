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
  Returns the v2 overview DTO seed for one community and time range.

  Providers may return partial data. The `GroupherServer.Analysis.Web` context is
  responsible for wrapping provider data into Dashboard-facing section status
  and error fields.
  """
  @callback overview(Community.t(), map()) :: {:ok, map()} | {:error, term()}

  @doc """
  Creates the provider website backing one community.
  """
  @callback create_website(Community.t()) :: {:ok, String.t()} | {:error, term()}
end
