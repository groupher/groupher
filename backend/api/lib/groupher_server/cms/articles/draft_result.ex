defmodule GroupherServer.CMS.Articles.DraftResult do
  @moduledoc """
  Builds the stable editor payload returned after creating an Article Draft.

      CreateStableDraft result
        -> DraftResult
        -> Article + Draft payload
  """

  @doc "Builds the editor payload without exposing result orchestration to Web adapters."
  @spec build(map()) :: {:ok, map()} | {:error, :invalid_draft_result}
  def build(%{article: article, draft: draft}) do
    {:ok, draft |> Map.from_struct() |> Map.put(:article, article)}
  end

  def build(_result), do: {:error, :invalid_draft_result}
end
