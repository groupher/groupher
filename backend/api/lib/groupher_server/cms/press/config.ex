defmodule GroupherServer.CMS.Press.Config do
  @moduledoc """
  Press-owned static configuration derived from CMS Article configuration.

  CMS Article config -> Press projection -> supported thread list.
  """

  alias GroupherServer.CMS.Artiment.Config, as: ArtimentConfig

  @doc "Returns Article threads that Press can project."
  @spec article_threads() :: [atom()]
  def article_threads, do: ArtimentConfig.threads()
end
