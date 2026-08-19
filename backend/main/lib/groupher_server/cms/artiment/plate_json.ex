defmodule GroupherServer.CMS.Artiment.PlateJSON do
  alias GroupherServer.CMS.ErrorCat
  @moduledoc """
  Decodes the canonical Plate JSON envelope without deriving content formats.

  Article BodyBags are produced by the Node publisher. This decoder remains in
  Elixir only for consumers such as Comment mention extraction that need to
  inspect the persisted AST shape.

  See `docs/bulk-import/article-publish-import-refactor.md` for why Elixir does not serialize Plate.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> PlateJSON
        -> Repo / domain event
  """

  @doc "Decodes a persisted Plate JSON root list without deriving content formats."
  @spec decode(String.t()) :: {:ok, list()} | {:error, term()}
  def decode(body) when is_binary(body) do
    with {:ok, value} <- Jason.decode(body),
         true <- is_list(value) do
      {:ok, value}
    else
      false -> {:error, ErrorCat.invalid_plate_json()}
      {:error, _reason} = error -> error
    end
  end

  def decode(_body), do: {:error, ErrorCat.invalid_body()}
end
