defmodule GroupherServer.CMS.Press.Reader do
  @moduledoc """
  Loads current public CMS authority for Press without creating view events.

  Business position:

      CMS.Press facade
        -> Press.Reader
        -> Gate Scope / Repo
        -> Press.Projection
  """

  require GroupherServer.CMS.Const
  require GroupherServer.CMS.Docs.Const

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat
  alias CMS.FrontDesk

  alias CMS.Gate.Context.Scope.Community, as: CommunityContext
  alias CMS.Model.{Community, DocBranch, DocPublishRelease, DocTreeNode, PressConfig}
  alias CMS.Press.{Config, Projection}

  @threads Config.article_threads()
  @manifest_limit 500

  @doc "Reads persisted Press config, falling back to the legacy dashboard projection."
  def config(community) do
    with {:ok, community} <- internal_community(community) do
      case Repo.get_by(PressConfig, community_id: community.id) do
        %PressConfig{} = config -> {:ok, config}
        nil -> {:ok, legacy_config(community)}
      end
    end
  end

  @doc "Resolves a Community for internal Press configuration work."
  def internal_community(%Community{} = community),
    do: {:ok, Repo.preload(community, [:dashboard, :lifecycle])}

  def internal_community(slug) when is_binary(slug) do
    Community
    |> Repo.get_by(slug: slug)
    |> case do
      nil -> {:error, CMS.Communities.ErrorCat.not_exist("Community")}
      community -> {:ok, Repo.preload(community, [:dashboard, :lifecycle])}
    end
  end

  @doc "Reads and projects one current public Article for Press."
  def article(%{community: community_ref, thread: thread, inner_id: inner_id})
      when thread in @threads do
    with {:ok, community} <- public_community(community_ref),
         {:ok, config} <- config(community),
         :ok <- ensure_enabled(config, :markdown_enabled),
         :ok <- ensure_thread_enabled(community, thread),
         {:ok, article} <- current_article(community, thread, inner_id) do
      {:ok, Projection.article(community, thread, article)}
    end
  end

  def article(_), do: {:error, ErrorCat.custom("invalid Press Article path")}

  @doc "Reads and projects a Community RSS feed."
  def community_rss_feed(community, opts) do
    with {:ok, community} <- public_community(community),
         {:ok, config} <- config(community),
         :ok <- ensure_enabled(config, :feed_enabled) do
      requested_threads = option(opts, :threads, config.feed_threads)
      threads = selected_threads(community, requested_threads)
      limit = bounded_limit(option(opts, :limit, config.feed_count), config.feed_count)
      items = feed_items(community, threads, limit)

      {:ok, Projection.feed(community, config, nil, items)}
    end
  end

  @doc "Reads and projects one thread RSS feed."
  def thread_rss_feed(community, thread, opts) when thread in @threads do
    with {:ok, community} <- public_community(community),
         {:ok, config} <- config(community),
         :ok <- ensure_enabled(config, :feed_enabled),
         :ok <- ensure_feed_thread(config, thread),
         :ok <- ensure_thread_enabled(community, thread) do
      limit = bounded_limit(option(opts, :limit, config.feed_count), config.feed_count)
      items = feed_items(community, [thread], limit)

      {:ok, Projection.feed(community, config, thread, items)}
    end
  end

  def thread_rss_feed(_, _, _),
    do: {:error, ErrorCat.custom("invalid Press Feed thread")}

  @doc "Reads and projects the current Press site manifest."
  def site_manifest(community) do
    with {:ok, community} <- public_community(community),
         {:ok, config} <- config(community) do
      threads = selected_threads(community, @threads)
      items = site_items(community, threads, @manifest_limit)

      {:ok,
       %{
         community: Projection.community(community),
         config: Projection.config(config),
         site_revision: Projection.revision(items, config.revision),
         threads: threads,
         items: items
       }}
    end
  end

  defp current_article(community, :doc, inner_id) do
    with {:ok, article} <-
           FrontDesk.article(%{community: community.slug, thread: :doc, inner_id: inner_id}),
         :ok <- ensure_stable_public_doc(article) do
      {:ok, article}
    else
      {:error, _reason} = error -> error
    end
  end

  defp current_article(community, thread, inner_id) do
    FrontDesk.article(%{community: community.slug, thread: thread, inner_id: inner_id})
  end

  defp ensure_stable_public_doc(article) do
    visible =
      DocTreeNode
      |> where([node], node.community_id == ^article.community_id)
      |> where([node], node.branch_id == ^article.branch_id)
      |> where([node], node.stage == ^CMS.Const.stage(:public))
      |> where([node], node.type == :page)
      |> where([node], node.doc_id == ^article.id)
      |> Repo.exists?()

    if visible,
      do: :ok,
      else: {:error, CMS.Articles.ErrorCat.not_exist("Published Doc")}
  end

  defp feed_items(community, threads, limit) do
    threads
    |> Enum.flat_map(&current_feed_items(community, &1, limit))
    |> Enum.sort_by(&(&1.updated_at || &1.published_at), {:desc, DateTime})
    |> Enum.take(limit)
  end

  defp site_items(community, threads, limit) do
    threads
    |> Enum.flat_map(fn thread ->
      community
      |> current_articles(thread, limit)
      |> Enum.map(&Projection.feed_item(community, thread, &1))
    end)
    |> Enum.sort_by(&(&1.updated_at || &1.published_at), {:desc, DateTime})
    |> Enum.take(limit)
  end

  defp current_feed_items(community, :doc, _limit) do
    DocPublishRelease
    |> join(:inner, [release], branch in DocBranch, on: branch.id == release.branch_id)
    |> where([release, branch], release.community_id == ^community.id)
    |> where([_release, branch], branch.type == ^CMS.Docs.Const.doc_branch_type(:main))
    |> order_by([release], desc: release.release_number, desc: release.id)
    |> preload([release], [:author, :articles])
    |> limit(1)
    |> Repo.all()
    |> Enum.map(&Projection.doc_release_feed_item(community, &1))
  end

  defp current_feed_items(community, thread, limit) do
    community
    |> current_articles(thread, limit)
    |> Enum.map(&Projection.feed_item(community, thread, &1))
  end

  defp current_articles(community, thread, limit) do
    case CMS.Articles.page(thread, %{community: community.slug, page: 1, size: limit}) do
      {:ok, %{entries: entries}} ->
        if thread == :doc do
          Enum.filter(entries, &stable_public_doc?/1)
        else
          entries
        end

      {:error, _reason} ->
        []
    end
  end

  defp stable_public_doc?(article), do: ensure_stable_public_doc(article) == :ok

  defp public_community(%Community{id: id}), do: public_community_by_id(id)

  defp public_community(slug) when is_binary(slug) do
    CMS.Gate.scope(Community, nil, :read, CommunityContext.public())
    |> where([community], community.slug == ^slug or community.aka == ^slug)
    |> preload([:dashboard, :lifecycle])
    |> Repo.one()
    |> case do
      nil -> {:error, CMS.Communities.ErrorCat.not_exist("Public Community")}
      community -> {:ok, community}
    end
  end

  defp public_community_by_id(id) when is_integer(id) do
    CMS.Gate.scope(Community, nil, :read, CommunityContext.public())
    |> where([community], community.id == ^id)
    |> preload([:dashboard, :lifecycle])
    |> Repo.one()
    |> case do
      nil -> {:error, CMS.Communities.ErrorCat.not_exist("Public Community")}
      community -> {:ok, community}
    end
  end

  defp legacy_config(community) do
    rss = community.dashboard && community.dashboard.rss

    %{
      id: nil,
      community_id: community.id,
      markdown_enabled: true,
      feed_enabled: false,
      feed_type: (rss && rss.rss_feed_type) || :digest,
      feed_count: (rss && rss.rss_feed_count) || 20,
      feed_threads: [],
      llms_enabled: true,
      sitemap_enabled: true,
      revision: 1,
      updated_at: community.dashboard && community.dashboard.updated_at
    }
  end

  defp selected_threads(community, requested) do
    requested
    |> Enum.map(&normalize_thread/1)
    |> Enum.filter(&(&1 in @threads))
    |> Enum.uniq()
    |> Enum.filter(&thread_enabled?(community, &1))
  end

  defp normalize_thread(thread) when is_atom(thread), do: thread
  defp normalize_thread(thread) when is_binary(thread), do: String.to_existing_atom(thread)

  defp ensure_feed_thread(config, thread) do
    if to_string(thread) in config.feed_threads,
      do: :ok,
      else: {:error, ErrorCat.custom("Press Feed thread is disabled")}
  end

  defp ensure_thread_enabled(community, thread) do
    if thread_enabled?(community, thread),
      do: :ok,
      else: {:error, ErrorCat.custom("Community thread is disabled")}
  end

  defp thread_enabled?(community, thread) do
    enable = community.dashboard && community.dashboard.enable
    is_nil(enable) || Map.get(enable, thread, true)
  end

  defp ensure_enabled(config, field) do
    if Map.get(config, field),
      do: :ok,
      else: {:error, ErrorCat.custom("Press output is disabled")}
  end

  defp bounded_limit(value, configured) when is_integer(value), do: min(max(value, 1), configured)
  defp bounded_limit(_, configured), do: configured

  defp option(opts, key, default) when is_list(opts), do: Keyword.get(opts, key, default)
  defp option(opts, key, default) when is_map(opts), do: Map.get(opts, key, default)
end
