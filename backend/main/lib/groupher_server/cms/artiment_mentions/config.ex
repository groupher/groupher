defmodule GroupherServer.CMS.ArtimentMentions.Config do
  @moduledoc """
  Static configuration for CMS artiment mention parsing and URL shaping.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Config
        -> Repo / external boundary
  """

  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS.Artiment.Config, as: ArtimentConfig

  @type t :: %__MODULE__{
          site_host: String.t(),
          threads: [atom()],
          mention_types: [atom()],
          valid_article_prefixes: [String.t()]
        }

  @site_host get_config(:general, :site_host)
  @threads ArtimentConfig.threads()

  defstruct site_host: @site_host,
            threads: @threads,
            mention_types: @threads ++ [:comment, :user, :url],
            valid_article_prefixes: Enum.map(@threads, &"#{@site_host}/#{&1}/")

  @spec base() :: t()
  def base, do: %__MODULE__{}

  @spec site_host() :: String.t()
  def site_host, do: base().site_host

  @spec threads() :: [atom()]
  def threads, do: base().threads

  @spec mention_types() :: [atom()]
  def mention_types, do: base().mention_types

  @spec valid_article_prefixes() :: [String.t()]
  def valid_article_prefixes, do: base().valid_article_prefixes

  @spec article_url(atom(), term()) :: String.t()
  def article_url(thread, id), do: "#{site_host()}/#{thread}/#{id}"

  @spec user_url(String.t()) :: String.t()
  def user_url(login), do: "#{site_host()}/u/#{login}"
end
