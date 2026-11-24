defmodule GroupherServerWeb.Schema.CMS.Press.Spec do
  @moduledoc """
  GraphQL DTOs for current public Press projections.

  Business position:

      Client
        -> Absinthe schema / Types
        -> resolver or domain context
        -> GraphQL response
  """

  use Absinthe.Schema.Notation

  enum :press_feed_type do
    @desc "Publish article summaries in the feed."
    value(:digest)
    @desc "Include full article content in the feed."
    value(:full)
  end

  object :press_config do
    @desc "Expose the public Markdown representation."
    field(:markdown_enabled, non_null(:boolean))
    @desc "Publish RSS feeds."
    field(:feed_enabled, non_null(:boolean))
    @desc "Whether feed items contain summaries or full content."
    field(:feed_type, non_null(:press_feed_type))
    @desc "Configured number of items per feed."
    field(:feed_count, non_null(:integer))

    @desc "Article threads included in the feed."
    field :feed_threads, non_null(list_of(non_null(:thread))) do
      resolve(fn config, _, _ ->
        threads = Enum.map(config.feed_threads, &normalize_thread/1)
        {:ok, threads}
      end)
    end

    @desc "Publish the llms.txt representation."
    field(:llms_enabled, non_null(:boolean))
    @desc "Publish the sitemap."
    field(:sitemap_enabled, non_null(:boolean))
    @desc "Revision of these Press settings."
    field(:revision, non_null(:integer))
  end

  input_object :update_press_config_input do
    @desc "Community whose Press settings should change."
    field(:community, non_null(:string))
    @desc "Whether to expose public Markdown."
    field(:markdown_enabled, :boolean)
    @desc "Whether to publish RSS feeds."
    field(:feed_enabled, :boolean)
    @desc "Whether feeds contain summaries or full content."
    field(:feed_type, :press_feed_type)
    @desc "Number of items to include per feed."
    field(:feed_count, :integer)
    @desc "Article threads to include in the feed."
    field(:feed_threads, list_of(non_null(:thread)))
    @desc "Whether to publish llms.txt."
    field(:llms_enabled, :boolean)
    @desc "Whether to publish the sitemap."
    field(:sitemap_enabled, :boolean)
  end

  input_object :press_community_rss_feed_input, name: "PressCommunityRSSFeedInput" do
    @desc "Maximum number of feed items requested."
    field(:limit, :integer)
    @desc "Restrict the feed to these article threads."
    field(:threads, list_of(non_null(:thread)))
  end

  input_object :press_thread_rss_feed_input, name: "PressThreadRSSFeedInput" do
    @desc "Maximum number of items requested from the thread."
    field(:limit, :integer)
  end

  object :press_config_payload do
    @desc "Press settings after the update."
    field(:config, non_null(:press_config))
  end

  object :press_author do
    @desc "Author's account login."
    field(:login, :string)
    @desc "Author's display name."
    field(:name, :string)
    @desc "URL of the author's avatar."
    field(:avatar, :string)
  end

  object :press_tag do
    @desc "Tag identifier used in URLs."
    field(:slug, non_null(:string))
    @desc "Display label for the tag."
    field(:title, non_null(:string))
  end

  object :press_community do
    @desc "Stable public community identifier."
    field(:public_ref, non_null(:string))
    @desc "Community identifier used in routes."
    field(:slug, non_null(:string))
    @desc "Community display name."
    field(:title, non_null(:string))
    @desc "Community introduction."
    field(:description, :string)
    @desc "Language of the community."
    field(:locale, non_null(:string))
    @desc "Canonical scheme and host."
    field(:canonical_origin, non_null(:string))
    @desc "Path of the community on its canonical origin."
    field(:canonical_path, non_null(:string))
  end

  object :press_article do
    @desc "Public reference of the owning community."
    field(:community_ref, non_null(:string))
    @desc "Stable ID of the published article."
    field(:article_id, non_null(:id))
    @desc "Version of the public content projection."
    field(:content_version, non_null(:string))
    @desc "Thread containing the article."
    field(:thread, non_null(:thread))
    @desc "Article path on the canonical origin."
    field(:canonical_path, non_null(:string))
    @desc "Canonical scheme and host."
    field(:canonical_origin, non_null(:string))
    @desc "Absolute canonical article URL."
    field(:canonical_url, non_null(:string))
    @desc "Published headline."
    field(:title, non_null(:string))
    @desc "Published subtitle."
    field(:subtitle, :string)
    @desc "Published article body as Markdown."
    field(:markdown, non_null(:string))
    @desc "Published article body as HTML, when available."
    field(:html, :string)
    @desc "Summary of the published content."
    field(:digest, :string)
    @desc "When the article was published."
    field(:published_at, non_null(:datetime))
    @desc "When the public content was last updated."
    field(:updated_at, non_null(:datetime))
    @desc "Author exposed in the public projection."
    field(:author, :press_author)
    @desc "Tags on the published article."
    field(:tags, non_null(list_of(non_null(:press_tag))))
    @desc "Visibility reported for the article."
    field(:visibility, non_null(:string))
  end

  object :press_rss_feed_item, name: "PressRSSFeedItem" do
    @desc "Stable identifier for the feed entry."
    field(:item_id, non_null(:string))
    @desc "Version of the public content projection."
    field(:content_version, non_null(:string))
    @desc "Article thread for this entry."
    field(:thread, non_null(:thread))
    @desc "Published entry title."
    field(:title, non_null(:string))
    @desc "Summary text for the feed entry."
    field(:digest, :string)
    @desc "Full HTML content when included in the feed."
    field(:html, :string)
    @desc "Canonical URL of the source article."
    field(:canonical_url, non_null(:string))
    @desc "When the article was published."
    field(:published_at, non_null(:datetime))
    @desc "When the entry was last updated."
    field(:updated_at, non_null(:datetime))
    @desc "Public author information."
    field(:author, :press_author)
    @desc "Tags attached to the article."
    field(:tags, non_null(list_of(non_null(:press_tag))))
  end

  object :press_community_rss_feed, name: "PressCommunityRSSFeed" do
    @desc "Community that owns the feed."
    field(:community, non_null(:press_community))
    @desc "Press settings used to build the feed."
    field(:config, non_null(:press_config))
    @desc "Revision of the Press settings."
    field(:config_revision, non_null(:integer))
    @desc "Revision identifying this feed projection."
    field(:feed_revision, non_null(:string))
    @desc "Published entries selected for this community feed."
    field(:items, non_null(list_of(non_null(:press_rss_feed_item))))
  end

  object :press_thread_rss_feed, name: "PressThreadRSSFeed" do
    @desc "Community that owns the feed."
    field(:community, non_null(:press_community))
    @desc "Press settings used to build the feed."
    field(:config, non_null(:press_config))
    @desc "Article thread represented by the feed."
    field(:thread, non_null(:thread))
    @desc "Revision of the Press settings."
    field(:config_revision, non_null(:integer))
    @desc "Revision identifying this feed projection."
    field(:feed_revision, non_null(:string))
    @desc "Published entries selected for this thread."
    field(:items, non_null(list_of(non_null(:press_rss_feed_item))))
  end

  object :press_site_manifest do
    @desc "Community described by the manifest."
    field(:community, non_null(:press_community))
    @desc "Press settings used to build the manifest."
    field(:config, non_null(:press_config))
    @desc "Revision identifying this site projection."
    field(:site_revision, non_null(:string))
    @desc "Threads represented in the manifest."
    field(:threads, non_null(list_of(non_null(:thread))))
    @desc "Published entries listed in the manifest."
    field(:items, non_null(list_of(non_null(:press_rss_feed_item))))
  end

  defp normalize_thread(thread) when is_atom(thread), do: thread
  defp normalize_thread(thread) when is_binary(thread), do: String.to_existing_atom(thread)
end
