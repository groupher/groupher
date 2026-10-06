defmodule GroupherServer.CMS.Press.Projection do
  @moduledoc """
  Builds side-effect-free Press projections from already-authorized CMS data.

  Business position:

      Press.Query
        -> Press.Projection
        -> markdown / feed / manifest response
  """

  import Helper.Utils, only: [get_config: 2]

  @site_host get_config(:general, :site_host)

  @doc "Projects one public Article for Press."
  def article(community, thread, article) do
    path = canonical_path(community.slug, thread, article)

    %{
      community_ref: community.slug,
      article_id: article.article_id,
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
      author: author(article.author),
      tags: Enum.map(article.community_tags, &tag/1),
      visibility: "public"
    }
  end

  @doc "Projects one Article as a Press feed item."
  def feed_item(community, thread, article) do
    article(community, thread, article)
    |> Map.take([
      :article_id,
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
    |> Map.put(:item_id, article.article_id)
    |> Map.delete(:article_id)
  end

  @doc "Projects the latest Docs release as one feed item."
  def doc_release_feed_item(community, release) do
    digest =
      release.articles
      |> Enum.sort_by(&{&1.index || 1_000_000, &1.id})
      |> Enum.map_join("; ", fn article ->
        actions =
          if article.actions == [], do: "published", else: Enum.join(article.actions, ", ")

        "#{article.title} (#{actions})"
      end)

    %{
      item_id: "#{community.slug}:docs:#{release.version_slug}",
      article_revision: "release-#{release.release_number}",
      thread: :doc,
      title: "#{community.title} Docs update",
      digest: digest,
      html: nil,
      canonical_url: @site_host <> "/#{community.slug}/doc",
      published_at: release.published_at,
      updated_at: release.published_at,
      author: user(release.author),
      tags: []
    }
  end

  @doc "Builds one RSS feed projection."
  def feed(community, config, thread, items) do
    %{
      community: community(community),
      config: config(config),
      thread: thread,
      config_revision: config.revision,
      feed_revision: revision(items, config.revision),
      items: items
    }
  end

  @doc "Builds the stable public Community projection used by Press outputs."
  def community(community) do
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

  @doc "Builds the persisted Press config snapshot exposed in public outputs."
  def config(config) do
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

  @doc "Derives a stable revision from projected items and config revision."
  def revision(items, config_revision) do
    value =
      items
      |> Enum.map_join("|", &"#{&1.item_id}:#{&1.article_revision}")
      |> then(&"#{config_revision}|#{&1}")

    :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)
  end

  defp author(nil), do: nil
  defp author(%{user: user}) when not is_nil(user), do: user(user)
  defp author(%{login: _login} = user), do: user(user)
  defp author(_), do: nil

  defp user(nil), do: nil

  defp user(user) do
    %{login: user.login, name: user.nickname || user.login, avatar: user.avatar}
  end

  defp tag(tag), do: %{slug: tag.slug, title: tag.title}

  defp canonical_path(community, :doc, article) do
    slug = if Map.get(article, :slug) in [nil, ""], do: nil, else: "/#{article.slug}"
    "/#{community}/doc/#{article.inner_id}#{slug}"
  end

  defp canonical_path(community, thread, article) do
    "/#{community}/#{thread}/#{article.inner_id}"
  end

  defp article_revision(article) do
    body_revision = article.body_hash || article.document.body_hash || "no-body-hash"
    "#{body_revision}:#{DateTime.to_iso8601(article.updated_at)}"
  end
end
