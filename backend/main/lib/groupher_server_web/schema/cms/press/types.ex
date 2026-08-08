defmodule GroupherServerWeb.Schema.CMS.Press.Types do
  @moduledoc "GraphQL DTOs for current public Press projections."

  use Absinthe.Schema.Notation

  enum :press_feed_type do
    value(:digest)
    value(:full)
  end

  object :press_config do
    field(:markdown_enabled, non_null(:boolean))
    field(:feed_enabled, non_null(:boolean))
    field(:feed_type, non_null(:press_feed_type))
    field(:feed_count, non_null(:integer))

    field :feed_threads, non_null(list_of(non_null(:thread))) do
      resolve(fn config, _, _ ->
        threads = Enum.map(config.feed_threads, &normalize_thread/1)
        {:ok, threads}
      end)
    end

    field(:llms_enabled, non_null(:boolean))
    field(:sitemap_enabled, non_null(:boolean))
    field(:revision, non_null(:integer))
  end

  input_object :update_press_config_input do
    field(:community, non_null(:string))
    field(:markdown_enabled, :boolean)
    field(:feed_enabled, :boolean)
    field(:feed_type, :press_feed_type)
    field(:feed_count, :integer)
    field(:feed_threads, list_of(non_null(:thread)))
    field(:llms_enabled, :boolean)
    field(:sitemap_enabled, :boolean)
  end

  input_object :press_community_rss_feed_input, name: "PressCommunityRSSFeedInput" do
    field(:limit, :integer)
    field(:threads, list_of(non_null(:thread)))
  end

  input_object :press_thread_rss_feed_input, name: "PressThreadRSSFeedInput" do
    field(:limit, :integer)
  end

  object :press_config_payload do
    field(:config, non_null(:press_config))
  end

  object :press_author do
    field(:login, :string)
    field(:name, :string)
    field(:avatar, :string)
  end

  object :press_tag do
    field(:slug, non_null(:string))
    field(:title, non_null(:string))
  end

  object :press_community do
    field(:public_ref, non_null(:string))
    field(:slug, non_null(:string))
    field(:title, non_null(:string))
    field(:description, :string)
    field(:locale, non_null(:string))
    field(:canonical_origin, non_null(:string))
    field(:canonical_path, non_null(:string))
  end

  object :press_article do
    field(:community_ref, non_null(:string))
    field(:article_ref, non_null(:string))
    field(:article_revision, non_null(:string))
    field(:thread, non_null(:thread))
    field(:canonical_path, non_null(:string))
    field(:canonical_origin, non_null(:string))
    field(:canonical_url, non_null(:string))
    field(:title, non_null(:string))
    field(:subtitle, :string)
    field(:markdown, non_null(:string))
    field(:html, :string)
    field(:digest, :string)
    field(:body_hash, :string)
    field(:published_at, non_null(:datetime))
    field(:updated_at, non_null(:datetime))
    field(:author, :press_author)
    field(:tags, non_null(list_of(non_null(:press_tag))))
    field(:visibility, non_null(:string))
  end

  object :press_rss_feed_item, name: "PressRSSFeedItem" do
    field(:article_ref, non_null(:string))
    field(:article_revision, non_null(:string))
    field(:thread, non_null(:thread))
    field(:title, non_null(:string))
    field(:digest, :string)
    field(:html, :string)
    field(:canonical_url, non_null(:string))
    field(:published_at, non_null(:datetime))
    field(:updated_at, non_null(:datetime))
    field(:author, :press_author)
    field(:tags, non_null(list_of(non_null(:press_tag))))
  end

  object :press_community_rss_feed, name: "PressCommunityRSSFeed" do
    field(:community, non_null(:press_community))
    field(:config, non_null(:press_config))
    field(:config_revision, non_null(:integer))
    field(:feed_revision, non_null(:string))
    field(:items, non_null(list_of(non_null(:press_rss_feed_item))))
  end

  object :press_thread_rss_feed, name: "PressThreadRSSFeed" do
    field(:community, non_null(:press_community))
    field(:config, non_null(:press_config))
    field(:thread, non_null(:thread))
    field(:config_revision, non_null(:integer))
    field(:feed_revision, non_null(:string))
    field(:items, non_null(list_of(non_null(:press_rss_feed_item))))
  end

  object :press_site_manifest do
    field(:community, non_null(:press_community))
    field(:config, non_null(:press_config))
    field(:site_revision, non_null(:string))
    field(:threads, non_null(list_of(non_null(:thread))))
    field(:items, non_null(list_of(non_null(:press_rss_feed_item))))
  end

  defp normalize_thread(thread) when is_atom(thread), do: thread
  defp normalize_thread(thread) when is_binary(thread), do: String.to_existing_atom(thread)
end
