defmodule GroupherServer.CMS.Communities.Config do
  @moduledoc """
  Community policy configuration derived from CMS Article configuration.
  """

  alias GroupherServer.CMS.Artiment.Config, as: ArtimentConfig

  @doc "Returns Article and Comment thread keys supported by Community policy."
  @spec threads() :: [atom()]
  def threads, do: ArtimentConfig.threads()

  @doc "Returns non-Doc Article threads tracked by Community policy."
  @spec ordinary_article_threads() :: [atom()]
  def ordinary_article_threads, do: threads() -- [:doc]

  @doc "Returns the system-wide emotion allowlist used by Community policy."
  @spec emotions_whitelist() :: [atom()]
  def emotions_whitelist, do: ArtimentConfig.emotions_whitelist()

  @doc "Returns the default emotion set per thread used by Community policy."
  @spec default_thread_emotions() :: map()
  def default_thread_emotions, do: ArtimentConfig.default_thread_emotions()
end
