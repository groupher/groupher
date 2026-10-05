defmodule GroupherServer.CMS.Press do
  @moduledoc """
  Public CMS facade for side-effect-free Press output projections and config.

  Press reads never increment Article views or expose Drafts/history. The
  facade preserves the external API while owner modules handle queries,
  projections, config transactions, and post-commit invalidation.

  Business position:

      GraphQL resolver / job
        -> CMS.Press facade
        -> Query / ConfigWriter / Invalidation
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{Community, PressConfig}
  alias CMS.Press.{ConfigWriter, Invalidation, Query}

  @doc "Reads persisted or legacy Press configuration."
  @spec config(Community.t() | String.t()) :: {:ok, PressConfig.t() | map()} | {:error, term()}
  def config(community), do: Query.config(community)

  @doc "Updates Press config and its Activity fact."
  @spec update_config(Community.t() | String.t(), map(), User.t() | nil) ::
          {:ok, PressConfig.t()} | {:error, term()}
  def update_config(community, attrs, actor), do: ConfigWriter.update(community, attrs, actor)

  @doc "Sends best-effort Press cache invalidation after a public projection changes."
  @spec invalidate(Community.t() | String.t() | integer()) :: :ok
  def invalidate(community), do: Invalidation.invalidate(community)

  @doc "Reads one current public Article projection."
  @spec article(map()) :: {:ok, map()} | {:error, term()}
  def article(path), do: Query.article(path)

  @doc "Reads one Community RSS feed."
  @spec community_rss_feed(Community.t() | String.t(), map() | keyword()) ::
          {:ok, map()} | {:error, term()}
  def community_rss_feed(community, opts \\ %{}), do: Query.community_rss_feed(community, opts)

  @doc "Reads one thread RSS feed."
  @spec thread_rss_feed(Community.t() | String.t(), atom(), map() | keyword()) ::
          {:ok, map()} | {:error, term()}
  def thread_rss_feed(community, thread, opts \\ %{}) do
    Query.thread_rss_feed(community, thread, opts)
  end

  @doc "Reads the current Press site manifest."
  @spec site_manifest(Community.t() | String.t()) :: {:ok, map()} | {:error, term()}
  def site_manifest(community), do: Query.site_manifest(community)
end
