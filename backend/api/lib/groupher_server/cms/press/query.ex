defmodule GroupherServer.CMS.Press.Query do
  @moduledoc """
  Loads current public CMS authority for Press without creating view events.

  Business position:

      CMS.Press facade
        -> Press.Query
        -> Gate Scope / Repo
        -> Press.Projection

  Feed and manifest output needs immutable body snapshots, so it is not an
  ArticleLite consumer. The query reuses the Articles pagination selector for
  public visibility, ordering, and the Docs public tree, then resolves complete
  public projections through bounded `Articles.locators/1` batches. Press is a
  service-scoped request path and is not a pagination N+1 exception.
  """

  require GroupherServer.CMS.Const
  require GroupherServer.CMS.Docs.Const

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.{ErrorCat, FrontDesk}

  alias CMS.Gate.Context.Scope.Community, as: CommunityContext

  alias CMS.Model.{
    ArticleBodySnapshot,
    ArticlePublic,
    ArticleRevision,
    Community,
    DocBranch,
    DocBranchVersion,
    DocPublic,
    DocPublishRelease,
    DocTreeNode,
    PressConfig
  }

  alias CMS.Press.{Config, Projection}
  alias Helper.ORM.Pagi.Config, as: PagiConfig

  @threads Config.article_threads()
  @manifest_limit 500
  @pagination_page_size 100

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
  def internal_community(%Community{} = community) do
    {:ok, Repo.preload(community, [:dashboard, :lifecycle])}
  end

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
         {:ok, _} <- validate_enabled(config, :markdown_enabled),
         {:ok, _} <- validate_thread_enabled(community, thread),
         {:ok, article} <- current_article(community, thread, inner_id) do
      {:ok, Projection.article(community, thread, article)}
    end
  end

  def article(_), do: {:error, ErrorCat.custom("invalid Press Article path")}

  @doc "Reads and projects a Community RSS feed."
  def community_rss_feed(community, opts) do
    with {:ok, community} <- public_community(community),
         {:ok, config} <- config(community),
         {:ok, _} <- validate_enabled(config, :feed_enabled) do
      requested_threads = option(opts, :threads, config.feed_threads)
      threads = selected_threads(community, requested_threads)
      limit = bounded_limit(option(opts, :limit, config.feed_count), config.feed_count)
      hydrate = hydrate_loader(opts)

      with {:ok, items} <- feed_items(community, threads, limit, hydrate) do
        {:ok, Projection.feed(community, config, nil, items)}
      end
    end
  end

  @doc "Reads and projects one thread RSS feed."
  def thread_rss_feed(community, thread, opts) when thread in @threads do
    with {:ok, community} <- public_community(community),
         {:ok, config} <- config(community),
         {:ok, _} <- validate_enabled(config, :feed_enabled),
         {:ok, _} <- validate_feed_thread(config, thread),
         {:ok, _} <- validate_thread_enabled(community, thread) do
      limit = bounded_limit(option(opts, :limit, config.feed_count), config.feed_count)
      hydrate = hydrate_loader(opts)

      with {:ok, items} <- feed_items(community, [thread], limit, hydrate) do
        {:ok, Projection.feed(community, config, thread, items)}
      end
    end
  end

  def thread_rss_feed(_, _, _) do
    {:error, ErrorCat.custom("invalid Press Feed thread")}
  end

  @doc "Reads and projects the current Press site manifest."
  def site_manifest(community), do: site_manifest(community, [])

  @doc false
  def site_manifest(community, opts) when is_list(opts) do
    with {:ok, community} <- public_community(community),
         {:ok, config} <- config(community) do
      threads = selected_threads(community, @threads)
      hydrate = hydrate_loader(opts)

      with {:ok, items} <- site_items(community, threads, @manifest_limit, hydrate) do
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
  end

  defp current_article(community, :doc, inner_id) do
    with {:ok, article} <-
           FrontDesk.article(%{community: community.slug, thread: :doc, inner_id: inner_id}),
         {:ok, _} <- validate_stable_public_doc(article, community) do
      {:ok, article}
    else
      {:error, _reason} = error -> error
    end
  end

  defp current_article(community, thread, inner_id) do
    FrontDesk.article(%{community: community.slug, thread: thread, inner_id: inner_id})
  end

  defp validate_stable_public_doc(article, community) do
    visible =
      DocTreeNode
      |> where([node], node.community_id == ^community.id)
      |> where([node], node.branch_id == ^article.branch_id)
      |> where([node], node.stage == ^CMS.Const.stage(:public))
      |> where([node], node.type == :page)
      |> where([node], node.doc_id == ^article.id)
      |> Repo.exists?()

    if visible do
      {:ok, :pass}
    else
      {:error, CMS.Articles.ErrorCat.not_exist("Published Doc")}
    end
  end

  defp feed_items(community, threads, limit, hydrate) do
    loader = fn community, thread, limit ->
      current_feed_items(community, thread, limit, hydrate)
    end

    with {:ok, items} <- collect_thread_items(community, threads, limit, loader) do
      {:ok,
       items
       |> Enum.sort_by(&(&1.updated_at || &1.published_at), {:desc, DateTime})
       |> Enum.take(limit)}
    end
  end

  defp site_items(community, threads, limit, hydrate) do
    with {:ok, items} <-
           collect_thread_items(community, threads, limit, fn community, thread, limit ->
             with {:ok, articles} <- current_articles(community, thread, limit, hydrate) do
               {:ok, Enum.map(articles, &Projection.feed_item(community, thread, &1))}
             end
           end) do
      {:ok,
       items
       |> Enum.sort_by(&(&1.updated_at || &1.published_at), {:desc, DateTime})
       |> Enum.take(limit)}
    end
  end

  defp collect_thread_items(community, threads, limit, loader) do
    Enum.reduce_while(threads, {:ok, []}, fn thread, {:ok, acc} ->
      case loader.(community, thread, limit) do
        {:ok, items} -> {:cont, {:ok, [items | acc]}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, List.flatten(Enum.reverse(items))}
      {:error, _reason} = error -> error
    end
  end

  defp current_feed_items(community, :doc, _limit, _hydrate) do
    {:ok,
     DocPublishRelease
     |> join(:inner, [release], branch in DocBranch, on: branch.id == release.branch_id)
     |> where([release, branch], release.community_id == ^community.id)
     |> where([_release, branch], branch.type == ^CMS.Docs.Const.doc_branch_type(:main))
     |> order_by([release], desc: release.release_number, desc: release.id)
     |> preload([release], [:author, :articles])
     |> limit(1)
     |> Repo.all()
     |> Enum.map(&Projection.doc_release_feed_item(community, &1))}
  end

  defp current_feed_items(community, thread, limit, hydrate) do
    with {:ok, articles} <- current_articles(community, thread, limit, hydrate) do
      {:ok, Enum.map(articles, &Projection.feed_item(community, thread, &1))}
    end
  end

  defp current_articles(community, thread, limit, hydrate) do
    with paths when is_list(paths) <- article_paths(community, thread, limit) do
      hydrate.(paths)
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp article_paths(community, thread, limit) do
    page_count = div(limit + @pagination_page_size - 1, @pagination_page_size)
    public_tree = thread == :doc

    1..page_count
    |> Enum.reduce_while({[], 0, limit}, fn page, {path_batches, collected, target} ->
      remaining = target - collected

      if remaining <= 0 do
        {:halt, {path_batches, collected, target}}
      else
        case CMS.Articles.Pagination.page(
               thread,
               %{community: community.slug},
               %GroupherServer.Pagi.Params.Offset{
                 page: page,
                 size: @pagination_page_size,
                 config_revision: 0
               },
               nil,
               config: press_pagination_config(),
               public_tree: public_tree
             ) do
          {:ok, %{entries: entries, pinned_entries: pinned_entries}} ->
            page_entries = if page == 1, do: pinned_entries ++ entries, else: entries
            page_paths = Enum.map(page_entries, &article_path(community, thread, &1))
            target = if page == 1, do: limit + length(pinned_entries), else: target
            remaining = target - collected
            batch = Enum.take(page_paths, remaining)
            next = {[batch | path_batches], collected + length(batch), target}

            if length(entries) < @pagination_page_size, do: {:halt, next}, else: {:cont, next}

          {:error, reason} ->
            {:halt, {:error, reason}}
        end
      end
    end)
    |> case do
      {:error, reason} -> {:error, reason}
      {path_batches, _collected, _target} -> List.flatten(Enum.reverse(path_batches))
    end
  end

  defp article_path(community, thread, entry) do
    %{path: %{community: community.slug, thread: thread, inner_id: entry.inner_id}, entry: entry}
  end

  defp hydrate_articles(path_entries) do
    path_entries
    |> Enum.chunk_every(@pagination_page_size)
    |> Enum.reduce_while({:ok, []}, fn chunk, {:ok, collected} ->
      with {:ok, admitted} <- CMS.Articles.locators(Enum.map(chunk, & &1.path)),
           paths = MapSet.new(admitted, &path_key(&1.path)),
           visible = Enum.filter(chunk, &MapSet.member?(paths, path_key(&1.path))),
           {:ok, publications} <- publications(Enum.map(visible, & &1.entry)) do
        {:cont, {:ok, collected ++ publications}}
      else
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  # Feed/manifest bodies belong to immutable public revisions, not list DTOs.
  defp publications(entries) do
    ordinary_ids = entries |> Enum.reject(&(&1.thread == :doc)) |> Enum.map(& &1.id)
    doc_ids = entries |> Enum.filter(&(&1.thread == :doc)) |> Enum.map(& &1.id)
    communities = Enum.map(entries, & &1.community.id)

    ordinary =
      from(public in ArticlePublic,
        join: revision in ArticleRevision,
        on: revision.id == public.revision_id,
        join: body in ArticleBodySnapshot,
        on: body.id == revision.body_snapshot_id,
        where: public.article_id in ^ordinary_ids,
        select: {public.article_id, public, body}
      )
      |> Repo.all()
      |> Map.new(fn {id, public, body} -> {id, {public, body}} end)

    docs =
      from(public in DocPublic,
        join: branch in DocBranch,
        on: branch.id == public.branch_id and branch.type == :main,
        join: version in DocBranchVersion,
        on: version.id == public.branch_version_id,
        join: revision in ArticleRevision,
        on: revision.id == version.revision_id,
        join: body in ArticleBodySnapshot,
        on: body.id == revision.body_snapshot_id,
        where:
          public.article_id in ^doc_ids and branch.community_id in ^communities and public.visible,
        select: {public.article_id, branch.community_id, public, body}
      )
      |> Repo.all()
      |> Map.new(fn {id, community, public, body} -> {{id, community}, {public, body}} end)

    Enum.reduce_while(entries, {:ok, []}, fn entry, {:ok, collected} ->
      publication =
        if entry.thread == :doc do
          Map.get(docs, {entry.id, entry.community.id})
        else
          Map.get(ordinary, entry.id)
        end

      case publication do
        {public, body} ->
          item =
            public
            |> Map.take([
              :title,
              :digest,
              :subtitle,
              :slug,
              :body_hash,
              :published_at,
              :updated_at
            ])
            |> Map.merge(%{
              article_id: entry.id,
              inner_id: entry.inner_id,
              thread: entry.thread,
              body: body,
              author: entry.author,
              community_tags: entry.community_tags,
              inserted_at: entry.inserted_at
            })

          {:cont, {:ok, [item | collected]}}

        nil ->
          {:halt, {:error, ErrorCat.invalid_body("Article body projection is missing")}}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  defp path_key(%{community: community, thread: thread, inner_id: inner_id}) do
    {community, thread, inner_id}
  end

  defp press_pagination_config do
    %PagiConfig{
      api: :offset,
      default_size: @pagination_page_size,
      max_size: @pagination_page_size,
      revision: 0,
      platform_hard_max: PagiConfig.platform_hard_max()
    }
  end

  defp hydrate_loader(opts) do
    case option(opts, :hydrate_articles, nil) do
      loader when is_function(loader, 1) -> loader
      _ -> &hydrate_articles/1
    end
  end

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

  defp validate_feed_thread(config, thread) do
    if to_string(thread) in config.feed_threads do
      {:ok, :pass}
    else
      {:error, ErrorCat.custom("Press Feed thread is disabled")}
    end
  end

  defp validate_thread_enabled(community, thread) do
    if thread_enabled?(community, thread) do
      {:ok, :pass}
    else
      {:error, ErrorCat.custom("Community thread is disabled")}
    end
  end

  defp thread_enabled?(community, thread) do
    enable = community.dashboard && community.dashboard.enable
    is_nil(enable) || Map.get(enable, thread, true)
  end

  defp validate_enabled(config, field) do
    if Map.get(config, field) do
      {:ok, :pass}
    else
      {:error, ErrorCat.custom("Press output is disabled")}
    end
  end

  defp bounded_limit(value, configured) when is_integer(value), do: min(max(value, 1), configured)
  defp bounded_limit(_, configured), do: configured

  defp option(opts, key, default) when is_list(opts), do: Keyword.get(opts, key, default)
  defp option(opts, key, default) when is_map(opts), do: Map.get(opts, key, default)
end
