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
      article_id: article.id,
      content_version: content_version(article),
      thread: thread,
      canonical_path: path,
      canonical_origin: @site_host,
      canonical_url: @site_host <> path,
      title: article.title,
      subtitle: Map.get(article, :subtitle),
      markdown: article.body.markdown,
      html: article.body.html,
      digest: article.digest || article.body.digest,
      published_at: Map.get(article, :published_at, article.inserted_at),
      updated_at: Map.get(article, :public_updated_at, article.updated_at),
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
      :content_version,
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
    |> Map.put(:item_id, article.id)
    |> Map.delete(:article_id)
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
      |> Enum.map_join("|", &"#{&1.item_id}:#{&1.content_version}")
      |> then(&"#{config_revision}|#{&1}")

    :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)
  end

  defp author(nil), do: nil
  defp author(%{user: user}) when not is_nil(user), do: user(user)
  defp author(%{login: _login} = user), do: user(user)
  defp author(_), do: nil

  defp user(user) do
    %{login: user.login, name: user.nickname || user.login, avatar: user.avatar}
  end

  defp tag(tag), do: %{slug: tag.slug, title: tag.title}

  defp content_version(article) do
    Map.get(article, :snapshot_id)
  end

  defp canonical_path(community, :doc, article) do
    slug = if Map.get(article, :slug) in [nil, ""], do: nil, else: "/#{article.slug}"
    "/#{community}/doc/#{Map.fetch!(article, :inner_id)}#{slug}"
  end

  defp canonical_path(community, thread, article) do
    "/#{community}/#{thread}/#{Map.fetch!(article, :inner_id)}"
  end
end
