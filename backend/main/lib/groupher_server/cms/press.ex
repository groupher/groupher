defmodule GroupherServer.CMS.Press do
  @moduledoc """
  Side-effect-free public projection used by the Press output service.

  This context owns Press configuration and is the only Phoenix boundary that
  Press may use for current public content. It never increments Article views
  and never exposes drafts or historical snapshots.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Press
        -> Repo / external boundary
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [get_config: 2]

  alias Ecto.Multi
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Communities.Read
  alias CMS.Model.{ArticleBranch, Community, Doc, DocPublishRelease, DocTreeNode, PressConfig}
  alias Helper.{Constant, Later}

  require Logger

  require CMS.Const

  @threads [:post, :blog, :changelog, :doc]
  @public_stage CMS.Const.stage(:public)
  @audit_legal Constant.CMS.pending(:legal)
  @site_host get_config(:general, :site_host)
  @manifest_limit 500

  @spec config(Community.t() | String.t()) :: {:ok, PressConfig.t() | map()} | {:error, term()}
  @doc "Runs `config` through the public `Press` boundary."
  def config(community) do
    with {:ok, community} <- internal_community(community) do
      case Repo.get_by(PressConfig, community_id: community.id) do
        %PressConfig{} = config -> {:ok, config}
        nil -> {:ok, legacy_config(community)}
      end
    end
  end

  @spec update_config(Community.t() | String.t(), map(), User.t() | nil) ::
          {:ok, PressConfig.t()} | {:error, term()}
  @doc "Updates config through the `Press` write boundary."
  def update_config(community, attrs, actor) do
    with {:ok, community} <- internal_community(community),
         {:ok, current} <- config(community) do
      attrs = normalize_config_attrs(attrs)

      changeset =
        case current do
          %PressConfig{id: id} = config when not is_nil(id) ->
            PressConfig.changeset(config, Map.put(attrs, :revision, config.revision + 1))

          _ ->
            PressConfig.changeset(
              %PressConfig{},
              current
              |> Map.take([
                :markdown_enabled,
                :feed_enabled,
                :feed_type,
                :feed_count,
                :feed_threads,
                :llms_enabled,
                :sitemap_enabled
              ])
              |> Map.merge(attrs)
              |> Map.merge(%{community_id: community.id, revision: 1})
            )
        end

      Multi.new()
      |> Multi.insert_or_update(:config, changeset)
      |> Multi.run(:audit, fn _, %{config: config} ->
        CMS.Audit.record("press.config_updated", %{
          actor: actor,
          community_id: community.id,
          resource_type: "press_config",
          resource_ref: community.slug,
          resource_snapshot: config_snapshot(config),
          metadata: %{revision: config.revision}
        })
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{config: config}} ->
          Later.run({__MODULE__, :invalidate, [community.slug]})
          {:ok, config}

        {:error, _step, reason, _changes} ->
          {:error, reason}
      end
    end
  end

  @doc """
  Best-effort notification to Press after a Phoenix-owned public projection changes.

  The HTTP call is intentionally outside the business transaction. Press keeps a
  short pointer TTL as the correctness fallback when the service is unavailable.
  """
  @spec invalidate(Community.t() | String.t() | integer()) :: :ok
  def invalidate(%Community{slug: slug}), do: invalidate(slug)

  def invalidate(community_id) when is_integer(community_id) do
    case Repo.get(Community, community_id) do
      %Community{slug: slug} -> invalidate(slug)
      _ -> :ok
    end
  end

  def invalidate(slug) when is_binary(slug) do
    endpoint = System.get_env("PRESS_INTERNAL_URL")

    token =
      GroupherServer.ServiceAuth.Client.token(
        System.get_env("PRESS_INTERNAL_RESOURCE") || "https://press.groupher.com/internal",
        ["press:cache:invalidate"]
      )

    if is_binary(endpoint) and endpoint != "" and match?({:ok, _}, token) do
      {:ok, token} = token

      case Req.post("#{String.trim_trailing(endpoint, "/")}/internal/invalidate",
             json: %{community: slug},
             headers: [{"authorization", "Bearer #{token}"}],
             receive_timeout: 5_000
           ) do
        {:ok, %{status: status}} when status in 200..299 -> :ok
        {:ok, %{status: status}} -> Logger.warning("Press invalidation returned HTTP #{status}")
        {:error, reason} -> Logger.warning("Press invalidation failed: #{inspect(reason)}")
      end
    end

    :ok
  end

  @spec article(map()) :: {:ok, map()} | {:error, term()}
  @doc "Runs `article` through the public `Press` boundary."
  def article(%{community: community_ref, thread: thread, inner_id: inner_id})
      when thread in @threads do
    with {:ok, community} <- public_community(community_ref),
         :ok <- ensure_community_public(community),
         {:ok, config} <- config(community),
         :ok <- ensure_enabled(config, :markdown_enabled),
         :ok <- ensure_thread_enabled(community, thread),
         {:ok, article} <- current_article(community, thread, inner_id) do
      {:ok, article_projection(community, thread, article)}
    end
  end

  def article(_), do: {:error, {:custom, "invalid Press Article path"}}

  @spec community_rss_feed(Community.t() | String.t(), map() | keyword()) ::
          {:ok, map()} | {:error, term()}
  @doc "Runs `community_rss_feed` through the public `Press` boundary."
  def community_rss_feed(community, opts \\ %{}) do
    with {:ok, community} <- public_community(community),
         :ok <- ensure_community_public(community),
         {:ok, config} <- config(community),
         :ok <- ensure_enabled(config, :feed_enabled) do
      requested_threads = option(opts, :threads, config.feed_threads)
      threads = selected_threads(community, requested_threads)
      limit = bounded_limit(option(opts, :limit, config.feed_count), config.feed_count)
      items = feed_items(community, threads, limit)

      {:ok, feed_projection(community, config, nil, items)}
    end
  end

  @spec thread_rss_feed(Community.t() | String.t(), atom(), map() | keyword()) ::
          {:ok, map()} | {:error, term()}
  @doc "Runs `thread_rss_feed` through the public `Press` boundary."
  def thread_rss_feed(community, thread, opts \\ %{})

  def thread_rss_feed(community, thread, opts) when thread in @threads do
    with {:ok, community} <- public_community(community),
         :ok <- ensure_community_public(community),
         {:ok, config} <- config(community),
         :ok <- ensure_enabled(config, :feed_enabled),
         :ok <- ensure_feed_thread(config, thread),
         :ok <- ensure_thread_enabled(community, thread) do
      limit = bounded_limit(option(opts, :limit, config.feed_count), config.feed_count)
      items = feed_items(community, [thread], limit)

      {:ok, feed_projection(community, config, thread, items)}
    end
  end

  def thread_rss_feed(_, _, _), do: {:error, {:custom, "invalid Press Feed thread"}}

  @spec site_manifest(Community.t() | String.t()) :: {:ok, map()} | {:error, term()}
  @doc "Runs `site_manifest` through the public `Press` boundary."
  def site_manifest(community) do
    with {:ok, community} <- public_community(community),
         :ok <- ensure_community_public(community),
         {:ok, config} <- config(community) do
      threads = selected_threads(community, @threads)
      items = site_items(community, threads, @manifest_limit)
      site_revision = revision(items, config.revision)

      {:ok,
       %{
         community: community_projection(community),
         config: config_snapshot(config),
         site_revision: site_revision,
         threads: threads,
         items: items
       }}
    end
  end

  defp current_article(community, thread, inner_id) do
    with {:ok, info} <- CMS.Artiment.Matcher.match(thread) do
      info.model
      |> CMS.Articles.active_scope(thread)
      |> join(:inner, [article], branch in ArticleBranch, on: branch.id == article.branch_id)
      |> where([article], article.community_id == ^community.id)
      |> where([_article, branch], branch.slug == "main")
      |> where([article], article.inner_id == ^inner_id)
      |> where([article], article.stage == ^@public_stage)
      |> where([article], article.pending == ^@audit_legal)
      |> where([article], is_nil(article.archived_at))
      |> preload([article, _branch], [:document, :community_tags, author: :user])
      |> Repo.one()
      |> case do
        nil -> {:error, {:not_exist, "Press Article"}}
        %{document: nil} -> {:error, {:not_exist, "Press Article document"}}
        article -> ensure_current_public_article(thread, article)
      end
    end
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
      |> Enum.map(&feed_item(community, thread, &1))
    end)
    |> Enum.sort_by(&(&1.updated_at || &1.published_at), {:desc, DateTime})
    |> Enum.take(limit)
  end

  defp current_feed_items(community, :doc, _limit) do
    DocPublishRelease
    |> join(:inner, [release], branch in ArticleBranch, on: branch.id == release.branch_id)
    |> where([release, branch], release.community_id == ^community.id)
    |> where([_release, branch], branch.thread == :doc and branch.slug == "main")
    |> order_by([release], desc: release.release_number, desc: release.id)
    |> preload([release], [:author, :articles])
    |> limit(1)
    |> Repo.all()
    |> Enum.map(&doc_release_feed_item(community, &1))
  end

  defp current_feed_items(community, thread, limit) do
    community
    |> current_articles(thread, limit)
    |> Enum.map(&feed_item(community, thread, &1))
  end

  defp current_articles(community, :doc, limit) do
    Doc
    |> CMS.Articles.active_scope(:doc)
    |> join(:inner, [article], branch in ArticleBranch, on: branch.id == article.branch_id)
    |> join(:inner, [article, _branch], node in DocTreeNode,
      on:
        node.community_id == article.community_id and node.branch_id == article.branch_id and
          node.doc_id == article.article_hash_id and node.stage == ^@public_stage and
          node.type == :page
    )
    |> where([article], article.community_id == ^community.id)
    |> where([_article, branch], branch.slug == "main")
    |> where([article], article.stage == ^@public_stage)
    |> where([article], article.pending == ^@audit_legal)
    |> where([article], is_nil(article.archived_at))
    |> order_by([article], desc: article.active_at, desc: article.inserted_at)
    |> limit(^limit)
    |> preload([article, ...], [:document, :community_tags, author: :user])
    |> Repo.all()
    |> Enum.reject(&is_nil(&1.document))
  end

  defp current_articles(community, thread, limit) do
    with {:ok, info} <- CMS.Artiment.Matcher.match(thread) do
      info.model
      |> CMS.Articles.active_scope(thread)
      |> join(:inner, [article], branch in ArticleBranch, on: branch.id == article.branch_id)
      |> where([article], article.community_id == ^community.id)
      |> where([_article, branch], branch.slug == "main")
      |> where([article], article.stage == ^@public_stage)
      |> where([article], article.pending == ^@audit_legal)
      |> where([article], is_nil(article.archived_at))
      |> order_by([article], desc: article.active_at, desc: article.inserted_at)
      |> limit(^limit)
      |> preload([article, _branch], [:document, :community_tags, author: :user])
      |> Repo.all()
      |> Enum.reject(&is_nil(&1.document))
    else
      _ -> []
    end
  end

  defp ensure_current_public_article(:doc, article) do
    visible =
      DocTreeNode
      |> where([node], node.community_id == ^article.community_id)
      |> where([node], node.branch_id == ^article.branch_id)
      |> where([node], node.stage == ^CMS.Const.stage(:public))
      |> where([node], node.type == :page)
      |> where([node], node.doc_id == ^article.article_hash_id)
      |> Repo.exists?()

    if visible, do: {:ok, article}, else: {:error, {:not_exist, "Published Doc"}}
  end

  defp ensure_current_public_article(_thread, article), do: {:ok, article}

  defp article_projection(community, thread, article) do
    path = canonical_path(community.slug, thread, article)

    %{
      community_ref: community.slug,
      article_ref: article.article_hash_id,
      article_revision: article_revision(article),
      thread: thread,
      canonical_path: path,
      canonical_origin: @site_host,
      canonical_url: @site_host <> path,
      title: article.title,
      subtitle: Map.get(article, :subtitle),
      markdown: article.document.markdown,
      html: article.document.html,
      digest: article.digest || article.document.digest,
      body_hash: article.body_hash || article.document.body_hash,
      published_at: article.inserted_at,
      updated_at: article.updated_at,
      author: author_projection(article.author),
      tags: Enum.map(article.community_tags, &tag_projection/1),
      visibility: "public"
    }
  end

  defp feed_item(community, thread, article) do
    article_projection(community, thread, article)
    |> Map.take([
      :article_ref,
      :article_revision,
      :thread,
      :title,
      :digest,
      :html,
      :canonical_url,
      :published_at,
      :updated_at,
      :author,
      :tags
    ])
  end

  defp doc_release_feed_item(community, release) do
    digest =
      release.articles
      |> Enum.sort_by(&{&1.index || 1_000_000, &1.id})
      |> Enum.map(fn article ->
        actions =
          if article.actions == [], do: "published", else: Enum.join(article.actions, ", ")

        "#{article.title} (#{actions})"
      end)
      |> Enum.join("; ")

    %{
      article_ref: "#{community.slug}:docs:#{release.version_slug}",
      article_revision: "release-#{release.release_number}",
      thread: :doc,
      title: "#{community.title} Docs update",
      digest: digest,
      html: nil,
      canonical_url: @site_host <> "/#{community.slug}/doc",
      published_at: release.published_at,
      updated_at: release.published_at,
      author: user_projection(release.author),
      tags: []
    }
  end

  defp feed_projection(community, config, thread, items) do
    %{
      community: community_projection(community),
      config: config_snapshot(config),
      thread: thread,
      config_revision: config.revision,
      feed_revision: revision(items, config.revision),
      items: items
    }
  end

  defp community_projection(community) do
    %{
      public_ref: community.slug,
      slug: community.slug,
      title: community.title,
      description: community.desc,
      locale: community.locale || "en",
      canonical_origin: @site_host,
      canonical_path: "/#{community.slug}"
    }
  end

  defp author_projection(nil), do: nil

  defp author_projection(%{user: user}) when not is_nil(user) do
    user_projection(user)
  end

  defp author_projection(_), do: nil

  defp user_projection(nil), do: nil

  defp user_projection(user),
    do: %{login: user.login, name: user.nickname || user.login, avatar: user.avatar}

  defp tag_projection(tag), do: %{slug: tag.slug, title: tag.title}

  defp canonical_path(community, :doc, article) do
    slug = if Map.get(article, :slug) in [nil, ""], do: nil, else: "/#{article.slug}"
    "/#{community}/doc/#{article.inner_id}#{slug}"
  end

  defp canonical_path(community, thread, article),
    do: "/#{community}/#{thread}/#{article.inner_id}"

  defp article_revision(article) do
    body_revision = article.body_hash || article.document.body_hash || "no-body-hash"
    "#{body_revision}:#{DateTime.to_iso8601(article.updated_at)}"
  end

  defp revision(items, config_revision) do
    value =
      items
      |> Enum.map_join("|", &"#{&1.article_ref}:#{&1.article_revision}")
      |> then(&"#{config_revision}|#{&1}")

    :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)
  end

  defp internal_community(%Community{} = community),
    do: {:ok, Repo.preload(community, [:dashboard, :lifecycle])}

  defp internal_community(slug) when is_binary(slug) do
    Community
    |> Repo.get_by(slug: slug)
    |> case do
      nil -> {:error, {:not_exist, "Community"}}
      community -> {:ok, Repo.preload(community, [:dashboard, :lifecycle])}
    end
  end

  defp public_community(%Community{id: id}), do: public_community_by_id(id)

  defp public_community(slug) when is_binary(slug) do
    Read.scope(Community)
    |> where([c], c.slug == ^slug or c.aka == ^slug)
    |> preload([:dashboard, :lifecycle])
    |> Repo.one()
    |> case do
      nil -> {:error, {:not_exist, "Public Community"}}
      community -> {:ok, community}
    end
  end

  defp public_community_by_id(id) when is_integer(id) do
    Read.scope(Community)
    |> where([c], c.id == ^id)
    |> preload([:dashboard, :lifecycle])
    |> Repo.one()
    |> case do
      nil -> {:error, {:not_exist, "Public Community"}}
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

  defp normalize_config_attrs(attrs) do
    attrs = Enum.into(attrs, %{})

    case Map.fetch(attrs, :feed_threads) do
      {:ok, threads} ->
        Map.put(attrs, :feed_threads, Enum.map(threads, fn thread -> to_string(thread) end))

      :error ->
        attrs
    end
  end

  defp config_snapshot(config) do
    Map.take(config, [
      :markdown_enabled,
      :feed_enabled,
      :feed_type,
      :feed_count,
      :feed_threads,
      :llms_enabled,
      :sitemap_enabled,
      :revision
    ])
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
      else: {:error, {:custom, "Press Feed thread is disabled"}}
  end

  defp ensure_thread_enabled(community, thread) do
    if thread_enabled?(community, thread),
      do: :ok,
      else: {:error, {:custom, "Community thread is disabled"}}
  end

  defp thread_enabled?(community, thread) do
    enable = community.dashboard && community.dashboard.enable
    is_nil(enable) || Map.get(enable, thread, true)
  end

  defp ensure_enabled(config, field) do
    if Map.get(config, field), do: :ok, else: {:error, {:custom, "Press output is disabled"}}
  end

  defp ensure_community_public(%Community{} = community) do
    if Read.public?(community),
      do: :ok,
      else: {:error, {:not_exist, "Public Community"}}
  end

  defp bounded_limit(value, configured) when is_integer(value), do: min(max(value, 1), configured)
  defp bounded_limit(_, configured), do: configured

  defp option(opts, key, default) when is_list(opts), do: Keyword.get(opts, key, default)
  defp option(opts, key, default) when is_map(opts), do: Map.get(opts, key, default)
end
