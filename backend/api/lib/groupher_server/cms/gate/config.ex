defmodule GroupherServer.CMS.Gate.Config do
  @moduledoc """
  Gate-owned thread boundaries derived from the CMS Article configuration.

  Gate owns the distinction between ordinary Article resources and Doc
  resources; `CMS.Artiment.Config` remains the source of the configured
  Article thread values.

  CMS Article config -> Gate boundary -> resource classification.
  """

  alias GroupherServer.CMS.Artiment.Config, as: ArtimentConfig

  @article_threads ArtimentConfig.threads()
  @ordinary_article_threads @article_threads -- [:doc]

  @doc "Returns all configured Article threads recognized by Gate."
  @spec article_threads() :: [atom()]
  def article_threads, do: @article_threads

  @doc "Returns configured non-Doc Article threads recognized by Gate."
  @spec ordinary_article_threads() :: [atom()]
  def ordinary_article_threads, do: @ordinary_article_threads
end
