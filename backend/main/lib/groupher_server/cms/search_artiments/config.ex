defmodule GroupherServer.CMS.SearchArtiments.Config do
  @moduledoc """
  Runtime configuration contract for CMS artiment search.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Config
        -> search platform
  """

  @type t :: %__MODULE__{
          platform: module(),
          queue: module(),
          algolia: keyword()
        }

  defstruct platform: nil,
            queue: nil,
            algolia: []

  @doc "Returns the runtime search artiments configuration as a `%Config{}` struct."
  @spec runtime() :: t()
  def runtime do
    config = Application.fetch_env!(:groupher_server, :search_artiments)

    struct!(__MODULE__, %{
      platform: Keyword.fetch!(config, :platform),
      queue: Keyword.fetch!(config, :queue),
      algolia: Keyword.fetch!(config, :algolia)
    })
  end

  @spec platform() :: module()
  def platform, do: runtime().platform

  @spec queue() :: module()
  def queue, do: runtime().queue

  @spec algolia() :: keyword()
  def algolia, do: runtime().algolia
end
