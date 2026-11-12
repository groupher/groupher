defmodule GroupherServer.CMS.Articles.Body do
  @moduledoc """
  Provides one complete document conversion for Article content owners.

      WorkingCopy / Snapshot -> owned ArticleBody -> complete document / new owner copy

  Reads never regenerate formats or fall back to legacy inline fields. Callers
  authorize the owner and hold its lock when using the document in a write.
  """
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.ArticleBodyDocument

  @doc "Loads an authorized owner's complete body; preload lists before repeated reads."
  def document(owner) do
    owner |> Repo.preload(:body) |> Map.fetch!(:body) |> ArticleBodyDocument.document()
  end
end
