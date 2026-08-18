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

  @doc "Returns a `%Config{}` struct populated with the configured mention defaults."
  @spec base() :: t()
  def base, do: %__MODULE__{}

  @doc "Returns the configured site host used to shape mention URLs."
  @spec site_host() :: String.t()
  def site_host, do: base().site_host

  @doc "Returns the article thread atoms recognized inside mention targets."
  @spec threads() :: [atom()]
  def threads, do: base().threads

  @doc "Returns the mention target types supported by the mention parser."
  @spec mention_types() :: [atom()]
  def mention_types, do: base().mention_types

  @doc "Returns the site URL prefixes that identify a valid article mention link."
  @spec valid_article_prefixes() :: [String.t()]
  def valid_article_prefixes, do: base().valid_article_prefixes

  @doc """
  Builds the public article URL for a mention link.

  The result has the shape `site_host/thread/id`.

  ## Examples

      Config.article_url(:post, 123)
      #=> "https://groupher.com/post/123"

  """
  @spec article_url(atom(), term()) :: String.t()
  def article_url(thread, id), do: "#{site_host()}/#{thread}/#{id}"

  @doc """
  Builds the public user profile URL for a mention.

  The result has the shape `site_host/u/login`.

  ## Examples

      Config.user_url("mydearxym")
      #=> "https://groupher.com/u/mydearxym"

  """
  @spec user_url(String.t()) :: String.t()
  def user_url(login), do: "#{site_host()}/u/#{login}"
end
