defmodule GroupherServerWeb.Schema.Helper.Fields do
  @moduledoc """
  Expands CMS registries into Absinthe fields, arguments and enum values.
  Dashboard descriptions are compiled into GraphQL declarations; Ecto fields
  and defaults come from the same registry without GraphQL metadata.

  Business position:

      CMS registries -> Fields macros -> Absinthe schema -> Playground introspection
      GraphQL field -> assembled projection or resolver -> response
  """
  import Helper.Utils, only: [plural: 1]
  import Absinthe.Resolution.Helpers, only: [dataloader: 2]

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Author, Community}

  @emotions CMS.artiment_config_emotions()
  @comment_emotions CMS.artiment_config_comment_emotions()
  @all_emotions (@emotions ++ @comment_emotions) |> Enum.uniq()
  @threads CMS.artiment_config_threads()

  @dashboard_fields %{
    enable: %{
      post: "Whether posts are enabled.",
      blog: "Whether blog articles are enabled.",
      kanban: "Whether the kanban board is enabled.",
      changelog: "Whether the changelog is enabled.",
      doc: "Whether documentation is enabled.",
      about: "Whether the About page is enabled.",
      post_published_editing:
        "Community policy for editing published posts; null leaves it unspecified.",
      blog_published_editing:
        "Community policy for editing published blog articles; null leaves it unspecified.",
      changelog_published_editing:
        "Community policy for editing published changelogs; null leaves it unspecified.",
      doc_last_update: "Whether docs show the last update time.",
      doc_reaction: "Whether reactions are enabled on docs.",
      about_techstack: "Whether the About page shows the technology stack.",
      about_location: "Whether the About page shows the location.",
      about_links: "Whether the About page shows links.",
      about_media_report: "Whether the About page shows media coverage.",
      visitor_location_map: "Whether the visitor location map is enabled."
    },
    base_info: %{
      favicon: "Community favicon.",
      title: "Community display title.",
      locale: "Community display locale.",
      logo: "Community logo.",
      slug: "Community slug used in URLs.",
      desc: "Short community description.",
      introduction: "Community introduction.",
      homepage: "Community homepage URL.",
      city: "City listed by the community.",
      techstack: "Technologies listed by the community."
    },
    layout: %{
      theme_preset: "Color theme selected for the community.",
      custom_theme_preset: "Overrides for the custom community theme.",
      kanban_bg_colors: "Background colors for the kanban columns.",
      kanban_boards: "Kanban columns to display, in order.",
      post_layout: "Presentation of the post list.",
      kanban_layout: "Arrangement of kanban columns.",
      kanban_card_layout: "Detail level of individual kanban cards.",
      doc_cover_layout: "Presentation of the documentation cover page.",
      doc_faq_layout: "Arrangement of the documentation FAQ.",
      tag_layout: "Marker shown beside a tag.",
      inline_tag_layout: "Appearance of inline tag labels.",
      avatar_layout: "Shape of user avatars.",
      brand_layout: "Whether the community brand shows its logo, name or both.",
      community_layout: "Overall community page layout.",
      nav_active_layout: "How the active navigation item is highlighted.",
      topbar_enabled: "Whether to display the top bar.",
      topbar_bg: "Background color of the top bar.",
      topbar_bg_custom_color: "Custom top bar color when the custom palette entry is selected.",
      broadcast_layout: "Presentation of community announcements.",
      broadcast_bg: "Background color of community announcements.",
      broadcast_custom_bg: "Custom background color for community announcements.",
      broadcast_enable: "Whether to display community announcements.",
      broadcast_article_layout: "Presentation of announcements on article pages.",
      broadcast_article_bg: "Background color of article announcements.",
      broadcast_article_custom_bg: "Custom background color for article announcements.",
      broadcast_article_enable: "Whether to display announcements on article pages.",
      changelog_layout: "Presentation of the changelog list.",
      footer_layout: "Arrangement of footer links.",
      header_layout: "Arrangement of the community header.",
      overlay_dark: "Whether overlays use the dark theme."
    },
    seo: %{
      seo_enable: "Whether custom SEO metadata is enabled.",
      og_site_name: "Site name used in Open Graph previews.",
      og_title: "Title used in Open Graph previews.",
      og_description: "Summary used in Open Graph previews.",
      og_url: "Page URL used in Open Graph previews.",
      og_image: "Image used in Open Graph previews.",
      og_locale: "Locale used in Open Graph metadata.",
      og_publisher: "Publisher listed in Open Graph metadata.",
      tw_title: "Title used in Twitter cards.",
      tw_description: "Summary used in Twitter cards.",
      tw_url: "Page URL used in Twitter cards.",
      tw_card: "Twitter card format.",
      tw_site: "Twitter account associated with the site.",
      tw_image: "Image used in Twitter cards.",
      tw_image_width: "Width of the Twitter card image.",
      tw_image_height: "Height of the Twitter card image."
    },
    rss: %{
      rss_feed_type: "Whether RSS entries contain summaries or full content.",
      rss_feed_count: "Number of entries to include in the RSS feed."
    },
    name_alias: %{
      slug: "Key of the label being renamed.",
      name: "Custom display label.",
      original: "Original display label.",
      group: "Group containing the label."
    },
    header_link: %{
      id: "Identifier of the header item.",
      type: "Kind of header item.",
      title: "Text displayed for the header item.",
      url: "Destination URL of the header link."
    },
    footer_link: %{
      title: "Text displayed for the footer link.",
      link: "Destination of the footer link.",
      group: "Group containing the footer link.",
      group_index: "Display order of the footer group.",
      index: "Display order of the link within its group.",
      is_hot: "Whether the link is marked as popular.",
      is_new: "Whether the link is marked as new."
    },
    social_link: %{
      type: "Social platform linked by the community.",
      link: "Destination of the social link."
    },
    media_report: %{
      index: "Display order of this media mention.",
      title: "Headline of the media mention.",
      favicon: "Favicon of the publication.",
      site_name: "Name of the publication.",
      description: "Summary of the media mention.",
      url: "Link to the original coverage."
    },
    wallpaper: %{
      light: "Background settings for the light theme.",
      dark: "Background settings for the dark theme."
    },
    wallpaper_bg: %{
      type: "Kind of background to render.",
      source: "Source or preset used for the background.",
      asset_public_ref: "Public reference to the background asset.",
      static_asset_public_ref: "Public reference to the static background asset.",
      pattern: "Pattern overlay settings, including tone and intensity.",
      gradient: "Gradient renderer, colors and geometry.",
      effect: "Blur, brightness and saturation settings.",
      texture: "Texture type, intensity and renderer parameters."
    }
  }

  @dashboard_values %{
    post_layout: %{
      quora: "Quora-style post list.",
      ph: "Product Hunt-style post list.",
      masonry: "Arrange posts in a masonry grid.",
      minimal: "Show a minimal post list.",
      cover: "Show posts with prominent covers."
    },
    kanban_layout: %{
      classic: "Use the classic kanban board.",
      waterfall: "Use a waterfall arrangement for the board."
    },
    kanban_card_layout: %{
      simple: "Show compact kanban cards.",
      full: "Show detailed kanban cards."
    },
    doc_cover_layout: %{
      outline_columns: "Arrange the documentation outline in columns.",
      outline_toc: "Show the outline as a table of contents.",
      brief_cards: "Show brief documentation cards.",
      cover_cards: "Show documentation cards with cover images.",
      tile_cards: "Arrange documentation cards as tiles.",
      stack_cards: "Display documentation cards in stacks."
    },
    doc_faq_layout: %{
      flat: "Show FAQ entries in a flat list.",
      collapse: "Show FAQ entries as collapsible items.",
      search_hint: "Use the search-hint FAQ layout.",
      left_right: "Arrange the FAQ in two columns."
    },
    tag_layout: %{
      hash: "Mark tags with a hash sign.",
      dot: "Mark tags with a dot.",
      icon: "Mark tags with an icon."
    },
    inline_tag_layout: %{
      morandi: "Use muted Morandi colors for inline tags.",
      soft: "Use a soft background for inline tags.",
      solid: "Use a solid fill for inline tags.",
      border: "Outline inline tags with a border.",
      simple: "Use plain inline tag labels."
    },
    avatar_layout: %{
      circle: "Display circular avatars.",
      square: "Display square avatars."
    },
    brand_layout: %{
      both: "Display the community logo and name.",
      logo: "Display only the community logo.",
      text: "Display only the community name."
    },
    community_layout: %{
      classic: "Use the classic community layout.",
      hero: "Use a hero header for the community.",
      sidebar: "Use a sidebar for community navigation."
    },
    nav_active_layout: %{
      text: "Highlight the active item through its text.",
      gray_bg: "Highlight the active item with a gray background.",
      soft_bg: "Highlight the active item with a softly tinted background."
    },
    broadcast_layout: %{
      default: "Use the default community announcement layout.",
      center: "Center the community announcement."
    },
    broadcast_article_layout: %{
      default: "Use the default article announcement layout.",
      simple: "Use a simplified article announcement."
    },
    changelog_layout: %{
      classic: "Use the classic changelog list.",
      simple: "Use a simplified changelog list."
    },
    footer_layout: %{
      oneline: "Arrange footer links in one line.",
      group: "Organize footer links into groups."
    },
    header_layout: %{
      center: "Use a centered header layout.",
      right: "Use a right-aligned header layout.",
      float: "Use a floating header layout."
    },
    theme_preset: %{
      default: "Use the default community theme.",
      claude: "Use the Claude color palette.",
      solarized: "Use the Solarized color palette.",
      hn: "Use the Hacker News color palette.",
      custom: "Use the community's custom theme."
    },
    rss_feed_type: %{
      digest: "Include an article summary in each RSS entry.",
      full: "Include the full article content in each RSS entry."
    }
  }

  @enum_values %{
    post: "Community posts.",
    blog: "Blog articles.",
    changelog: "Changelog entries.",
    doc: "Documentation articles.",
    kanban: "Community kanban board.",
    account: "Account section.",
    about: "Community About section.",
    dashboard: "Community dashboard.",
    user: "User section.",
    publish: "Newest publication first.",
    upvotes: "Most upvotes first.",
    comments: "Most comments first.",
    views: "Most views first.",
    most_views: "Highest view count first.",
    least_views: "Lowest view count first.",
    asc_inserted: "Oldest creation time first.",
    desc_inserted: "Newest creation time first.",
    asc_active: "Least recently active first.",
    desc_active: "Most recently active first.",
    idea: "An idea or feature suggestion.",
    bug: "A bug report.",
    qa: "A question for the community.",
    discussion: "An open discussion.",
    default: "No specific workflow status assigned.",
    backlog: "Work kept in the backlog.",
    todo: "Work waiting to start.",
    wip: "Work in progress.",
    done: "Completed work.",
    resolved: "The issue has been resolved.",
    reject: "Rejected.",
    reject_dup: "Rejected as a duplicate.",
    reject_no_plan: "Rejected because the work is not planned.",
    reject_repro: "Rejected because the issue could not be reproduced.",
    reject_stale: "Rejected because the issue is stale.",
    approve: "Approve the reviewed content.",
    recheck: "Send the content for another review."
  }

  @doc "Declares the identity, content, relations and state shared by article detail types."
  defmacro general_article_fields do
    quote do
      @desc "Stable article ID, distinct from its community-local ID."
      field(:id, non_null(:id),
        resolve: fn source, _, _ ->
          {:ok, Map.get(source, :article_id) || Map.get(source, :id)}
        end
      )

      @desc "Article ID within this community and thread."
      field(:inner_id, :id)
      @desc "Version of the article snapshot returned."
      field(:version, non_null(:integer))
      @desc "Title of the article."
      field(:title, :string)

      @desc "Canonical rich-content document for this article."
      field(:body, non_null(:artiment_body),
        resolve: fn source, _args, _resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_body(source)
        end
      )

      @desc "Thumbnail metadata from the article body."
      field(:thumbnail, :json,
        resolve: fn source, _args, _resolution ->
          case GroupherServerWeb.Schema.Helper.Fields.article_body(source) do
            {:ok, nil} -> {:ok, nil}
            {:ok, document} -> {:ok, Map.get(document, :thumbnail)}
            error -> error
          end
        end
      )

      @desc "Assets referenced by this article."
      field(:asset_refs, non_null(list_of(non_null(:article_asset_ref))),
        resolve: fn source, _args, _resolution ->
          case Map.fetch(source, :asset_refs) do
            {:ok, asset_refs} -> {:ok, asset_refs}
            :error -> {:error, CMS.error_cat_invalid_body("Article asset refs are missing")}
          end
        end
      )

      @desc "Short preview of the article body."
      field(:digest, :string)
      @desc "Interaction and readership statistics for the article."
      field(:article_stats, :article_stats)
      @desc "Whether the article is pinned in this community."
      field(:is_pinned, :boolean)
      @desc "URL of the default article cover."
      field(:cover_url, :string)
      @desc "URL of the dark-mode article cover."
      field(:cover_url_dark, :string)

      @desc "Display adjustments for the article cover."
      field(:cover_edit_info, :cover_edit_info,
        resolve: &GroupherServerWeb.Resolvers.CMS.Articles.cover_edit_info/3
      )

      @desc "Tags assigned to the article in this community."
      field(:community_tags, list_of(:community_tag),
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :community_tags
          )
        end
      )

      @desc "Tags attached to the article snapshot."
      field(:article_tags, list_of(:community_tag),
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :article_tags
          )
        end
      )

      @desc "User who authored the article."
      field(:author, :user,
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :author
          )
        end
      )

      @desc "Community for this article binding."
      field(:community, :community,
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :community
          )
        end
      )

      @desc "Communities returned with this article."
      field(:communities, list_of(:community),
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :communities
          )
        end
      )

      @desc "Article metadata, including edit and comment-lock state."
      field(:meta, :article_meta,
        resolve: fn source, _, _ ->
          case Map.fetch(source, :meta) do
            {:ok, meta} when is_map(meta) ->
              {:ok, meta}

            _ ->
              {:ok,
               %{
                 thread: Map.get(source, :thread),
                 is_edited: Map.get(source, :is_edited),
                 is_comment_locked: Map.get(source, :comments_locked),
                 last_active_at: Map.get(source, :last_active_at)
               }}
          end
        end
      )

      @desc "ID of the write command associated with this result, when available."
      field(:command_id, :id,
        resolve: &GroupherServerWeb.Resolvers.CMS.CommandPayload.command_id/3
      )

      @desc "Lifecycle state of the article."
      field(:lifecycle, :article_lifecycle,
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :lifecycle
          )
        end
      )

      @desc "Copyright attribution for the article."
      field(:copy_right, :string)
      @desc "Source link for the article."
      field(:link_addr, :string)
    end
  end

  @doc "Returns an already assembled Article DTO relation or delegates legacy structs to Dataloader."
  @spec article_relation(map(), map(), Absinthe.Resolution.t(), atom()) :: term()
  def article_relation(%{author: %Author{user: %User{} = user}}, _args, _resolution, :author) do
    {:ok, user}
  end

  def article_relation(
        %{author: %Author{user: %Ecto.Association.NotLoaded{}}} = source,
        args,
        resolution,
        :author
      ) do
    load_relation(source, args, resolution, :author)
  end

  def article_relation(%{community: %Community{} = community}, _args, _resolution, :communities) do
    {:ok, [community]}
  end

  def article_relation(source, args, resolution, relation) do
    case Map.fetch(source, relation) do
      {:ok, %Ecto.Association.NotLoaded{}} -> load_relation(source, args, resolution, relation)
      {:ok, value} -> {:ok, value}
      :error -> load_relation(source, args, resolution, relation)
    end
  end

  @doc "Returns the canonical Article body from the assembled projection without a legacy fallback."
  @spec article_body(map()) :: {:ok, term()} | {:error, term()}
  def article_body(source) do
    case Map.fetch(source, :body) do
      {:ok, body} -> {:ok, body}
      :error -> {:error, CMS.error_cat_invalid_body("Article body projection is missing")}
    end
  end

  defp load_relation(source, args, resolution, relation) do
    resolver = Absinthe.Resolution.Helpers.dataloader(CMS, relation)
    resolver.(source, args, resolution)
  end

  @doc "Declares a single-value enum for each configured article thread."
  defmacro thread_enums do
    @threads
    |> Enum.map(
      &quote do
        enum unquote(:"#{&1}_thread") do
          @desc unquote("Identifies the #{&1} article thread.")
          value(unquote(&1))
        end
      end
    )
  end

  @doc "Adds the configured article threads to an enclosing enum."
  defmacro article_values do
    @threads
    |> Enum.map(
      &quote do
        @desc unquote("Identifies the #{&1} article thread.")
        value(unquote(&1))
      end
    )
  end

  @doc "Adds comment emotions, all output emotions, or article emotions accepted by the generic mutation."
  defmacro emotion_values(metric \\ :article) do
    emotions =
      case metric do
        :comment -> @comment_emotions
        # used by the sparse EmotionStat API output enum, which is shared by
        # both article and comment payloads.
        :all -> @all_emotions
        # UPVOTE/COLLECT have dedicated mutations and fixed ArticleStats fields;
        # they are not valid inputs for the generic emotion mutation.
        _ -> @emotions -- [:upvote, :collect]
      end

    emotions
    |> Enum.map(
      &quote do
        @desc unquote("The #{&1} reaction.")
        value(unquote(:"#{&1}"))
      end
    )
  end

  @doc "Declares counts, viewer flags and recent users for configured article reactions."
  defmacro emotion_fields do
    @emotions
    |> Enum.map(
      &quote do
        @desc unquote("Number of #{&1} reactions.")
        field(unquote(:"#{&1}_count"), :integer)
        @desc unquote("Whether the viewer has added the #{&1} reaction.")
        field(unquote(:"viewer_has_#{&1}ed"), :boolean)
        @desc unquote("Users who most recently added the #{&1} reaction.")
        field(unquote(:"latest_#{&1}_users"), list_of(:common_user))
      end
    )
  end

  @doc "Declares counts, viewer flags and recent users for configured comment reactions."
  defmacro emotion_fields(:comment) do
    @comment_emotions
    |> Enum.map(
      &quote do
        @desc unquote("Number of #{&1} reactions.")
        field(unquote(:"#{&1}_count"), :integer)
        @desc unquote("Whether the viewer has added the #{&1} reaction.")
        field(unquote(:"viewer_has_#{&1}ed"), :boolean)
        @desc unquote("Users who most recently added the #{&1} reaction.")
        field(unquote(:"latest_#{&1}_users"), list_of(:common_user))
      end
    )
  end

  @doc "Adds article creation, update and activity timestamps."
  defmacro timestamp_fields(:article) do
    quote do
      @desc "Creation timestamp for this record."
      field(:inserted_at, :datetime)
      @desc "Most recent update timestamp for this record."
      field(:updated_at, :datetime)
      @desc "Timestamp used to order the article by activity."
      field(:active_at, :datetime)
    end
  end

  @doc "Adds creation and update timestamps."
  defmacro timestamp_fields do
    quote do
      @desc "Creation timestamp for this record."
      field(:inserted_at, :datetime)
      @desc "Most recent update timestamp for this record."
      field(:updated_at, :datetime)
    end
  end

  @doc "Declares the content, reply summary, viewer state and lifecycle fields shared by comments."
  defmacro comment_general_fields do
    quote do
      @desc "Comment ID within its article."
      field(:inner_id, :id, resolve: &GroupherServerWeb.Resolvers.CMS.Comments.comment_inner_id/3)

      @desc "Canonical rich-content document for the comment."
      field(:body, non_null(:artiment_body),
        resolve: &GroupherServerWeb.Schema.Helper.Fields.comment_body/3
      )

      @desc "Revision of the comment body."
      field(:body_version, non_null(:integer),
        resolve: &GroupherServerWeb.Schema.Helper.Fields.comment_body_version/3
      )

      @desc "User who wrote the comment."
      field(:author, :user, resolve: dataloader(CMS, :author))
      @desc "Whether the comment is pinned."
      field(:is_pinned, :boolean)
      @desc "Article-local ID of the root comment in this reply thread."
      field(:root_inner_id, :id)
      @desc "Floor number assigned to the comment."
      field(:floor, :integer)
      @desc "Number of upvotes on the comment."
      field(:upvotes_count, :integer)
      @desc "Revision of the comment's interaction state."
      field(:comment_interaction_revision, :integer)

      @desc "ID of the write command associated with this result, when available."
      field(:command_id, :id,
        resolve: &GroupherServerWeb.Resolvers.CMS.CommandPayload.command_id/3
      )

      @desc "Outcome of the requested reaction change."
      field(:reaction_outcome, :reaction_outcome)
      @desc "Whether the commenter is the author of the article."
      field(:is_article_author, :boolean)

      @desc "Reaction statistics for the comment."
      field(:emotions, list_of(:emotion_stat),
        resolve: &GroupherServerWeb.Resolvers.CMS.Interactions.emotions/3
      )

      @desc "Additional comment state and moderation metadata."
      field(:meta, :comment_meta)
      @desc "Number of visible replies in the thread."
      field(:replies_count, non_null(:integer))
      @desc "User snapshots from the reply thread."
      field(:reply_participants, non_null(list_of(non_null(:participant_snapshot_user))))
      @desc "Timestamp of the most recent reply in the summary."
      field(:last_reply_at, :datetime)
      @desc "Revision of the reply listing."
      field(:replies_revision, non_null(:integer))
      @desc "Whether the comment is marked as folded."
      field(:is_folded, non_null(:boolean))

      @desc "Whether any entries remain in the reply listing."
      field(:has_reply_entries, non_null(:boolean),
        resolve: fn comment, _, _ ->
          {:ok, comment.reply_entries_count > 0}
        end
      )

      @desc "Article thread containing the comment."
      field(:thread, :thread)
      @desc "Whether the current viewer has upvoted the comment."
      field(:viewer_has_upvoted, :boolean)

      @desc "Comment this reply directly addresses."
      field(:reply_to_comment, :comment,
        resolve: fn parent, args, resolution ->
          case Map.get(parent, :reply_to_comment) do
            %Ecto.Association.NotLoaded{} ->
              dataloader(CMS, :reply_to_comment).(parent, args, resolution)

            loaded ->
              {:ok, loaded}
          end
        end
      )

      @desc "Lifecycle state of the comment."
      field(:lifecycle, :comment_lifecycle, resolve: dataloader(CMS, :lifecycle))

      timestamp_fields()
    end
  end

  @doc "Resolves a Comment body from a preloaded projection or canonical body row."
  def comment_body(%{body: %GroupherServer.CMS.Model.CommentBody{} = body}, _, _), do: {:ok, body}

  def comment_body(%{id: comment_id}, _, _) do
    case GroupherServer.Repo.get_by(GroupherServer.CMS.Model.CommentBody, comment_id: comment_id) do
      nil -> {:error, "comment body not found"}
      body -> {:ok, body}
    end
  end

  @doc "Resolves a Comment body version from a preloaded projection or canonical body row."
  def comment_body_version(
        %{body: %GroupherServer.CMS.Model.CommentBody{version: version}},
        _,
        _
      ) do
    {:ok, version}
  end

  def comment_body_version(%{id: comment_id}, _, _) do
    case GroupherServer.Repo.get_by(GroupherServer.CMS.Model.CommentBody, comment_id: comment_id) do
      nil -> {:error, "comment body not found"}
      body -> {:ok, body.version}
    end
  end

  # see: https://github.com/absinthe-graphql/absinthe/issues/363
  @doc "Exposes canonical PageInfo from the shared Pagi result."
  defmacro pagi_fields do
    quote do
      @desc "Pagination metadata for this result page."
      field :page_info, non_null(:page_info) do
        resolve(fn page, _, _ -> {:ok, Helper.ORM.Pagi.Page.info(page)} end)
      end
    end
  end

  @doc "Declares filters for article time window, tags, category, ordering and community."
  defmacro article_filter_fields do
    quote do
      @desc "Time window for the article list."
      field(:when, :when_enum)
      @desc "Match one community tag by slug; omit communityTags when using this filter."
      field(:community_tag, :string)
      @desc "Limit results to this article category."
      field(:cat, :article_cat_enum)
      @desc "Ranking to apply to the article list."
      field(:order, :article_order_enum)
      @desc "Match any of these community tag slugs."
      field(:community_tags, list_of(:string))
      @desc "Limit results to the community with this slug."
      field(:community, :string)
    end
  end

  @doc """
  General social profile fields for a user.

  These fields map to one `accounts.socials` row per user, not a list of social
  links. Add a new field here only when the fixed profile shape grows.
  """
  defmacro social_fields do
    quote do
      @desc "GitHub profile listed by the user."
      field(:github, :string)
      @desc "Company listed by the user."
      field(:company, :string)
      @desc "User's personal blog."
      field(:blog, :string)
      @desc "Douban profile listed by the user."
      field(:douban, :string)
      @desc "Twitter profile listed by the user."
      field(:twitter, :string)
      @desc "Zhihu profile listed by the user."
      field(:zhihu, :string)
      @desc "Dribbble profile listed by the user."
      field(:dribble, :string)
      @desc "Pinterest profile listed by the user."
      field(:pinterest, :string)
      @desc "Huaban profile listed by the user."
      field(:huaban, :string)
    end
  end

  @doc "Adds a count for each configured article thread."
  defmacro threads_count_fields do
    @threads
    |> Enum.map(
      &quote do
        @desc unquote("Number of #{plural(&1)}.")
        field(unquote(:"#{plural(&1)}_count"), :integer)
      end
    )
  end

  @doc "Adds the article's comment participant snapshots."
  defmacro comments_fields do
    quote do
      @desc "Snapshots of users who participated in the article's comments."
      field(:comments_participants, non_null(list_of(non_null(:participant_snapshot_user))))
    end
  end

  @doc "Adds presence flags and counts by article thread to collection folder metadata."
  defmacro collect_folder_meta_fields do
    @threads
    |> Enum.map(fn thread ->
      quote do
        @desc unquote("Whether the folder contains any #{plural(thread)}.")
        field(unquote(:"has_#{thread}"), :boolean)
        @desc unquote("Number of #{plural(thread)} in the folder.")
        field(unquote(:"#{thread}_count"), :integer)
      end
    end)
  end

  @doc "Expands to the field names accepted for casting a dashboard section."
  defmacro dsb_cast_fields(section \\ :layout) do
    schema = GroupherServer.CMS.dashboard_fields_macro_schema(section) |> Macro.escape()

    quote do
      Enum.reduce(unquote(schema), [], fn [k, _, _], acc ->
        [k] ++ acc
      end)
    end
  end

  @doc "Declares the command ID and non-excluded dashboard settings as flat mutation arguments."
  defmacro dsb_args(section \\ :layout, opts \\ []) do
    except = Keyword.get(opts, :except, [])

    fields =
      GroupherServer.CMS.dashboard_fields_macro_schema(section)
      |> Enum.reject(fn [key, _type, _default_v] -> key in except end)
      |> Enum.map(fn item ->
        [key, type, _default_v] = item

        quote do
          @desc unquote(get_in(@dashboard_fields, [section, key]))
          arg(unquote(key), unquote(to_absinthe_type(type, key)))
        end
      end)

    [
      quote do
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))
      end
      | fields
    ]
  end

  @doc "Declares Ecto fields and defaults from the dashboard section registry."
  defmacro dsb_fields(section \\ :layout) do
    GroupherServer.CMS.dashboard_fields_macro_schema(section)
    |> Enum.map(fn item ->
      [key, type, default_v] = item
      default_ast = Macro.escape(default_v)

      case type do
        :enum ->
          quote do
            # Dsb enums use the default Ecto.Enum flow:
            #   [:quora, :ph] -> internal :quora / :ph -> DB "quora" / "ph"
            field(unquote(key), Ecto.Enum,
              values: unquote(GroupherServer.CMS.dashboard_fields_enum_values(key)),
              default: unquote(default_ast)
            )
          end

        :rainbow_color ->
          quote do
            field(unquote(key), Ecto.Enum,
              values: unquote(GroupherServer.CMS.dashboard_fields_rainbow_colors()),
              default: unquote(default_ast)
            )
          end

        {:array, :kanban_board} ->
          quote do
            field(unquote(key), {:array, Ecto.Enum},
              values: unquote(GroupherServer.CMS.dashboard_kanban_boards_values_list()),
              default: unquote(default_ast)
            )
          end

        {:array, :rainbow_color} ->
          quote do
            field(unquote(key), {:array, Ecto.Enum},
              values: unquote(GroupherServer.CMS.dashboard_fields_rainbow_colors()),
              default: unquote(default_ast)
            )
          end

        _ ->
          quote do
            field(unquote(key), unquote(to_ecto_type(type)), default: unquote(default_ast))
          end
      end
    end)
  end

  defp build_dsb_gq_fields(section, opts) do
    except = Keyword.get(opts, :except, [])

    GroupherServer.CMS.dashboard_fields_macro_schema(section)
    |> Enum.reject(fn [key, _type, _default_v] -> key in except end)
    |> Enum.map(fn item ->
      [key, type, _default_v] = item

      quote do
        @desc unquote(get_in(@dashboard_fields, [section, key]))
        field(unquote(key), unquote(to_absinthe_type(type, key)))
      end
    end)
  end

  @doc "Declares the non-excluded dashboard settings as GraphQL fields."
  defmacro dsb_gq_fields(section \\ :layout, opts \\ []) do
    build_dsb_gq_fields(section, opts)
  end

  @doc """
  Expand a dashboard section schema into GraphQL input-object fields.

  This keeps section patch inputs aligned with `Dashboard.macro_schema/1`,
  while `dsb_args/2` remains for legacy flat mutation arguments. This macro is
  intentionally a semantic wrapper around the same generator as `dsb_gq_fields/2`:
  Absinthe accepts the same `field/2` declarations inside object and input-object
  blocks, so the actual field-generation logic should stay in one place.

  ## Example

      input_object :dsb_bg_config_input do
        dsb_input_fields(:wallpaper_bg)
      end

  """
  defmacro dsb_input_fields(section \\ :layout, opts \\ []) do
    build_dsb_gq_fields(section, opts)
  end

  @doc "Builds a map of the registered defaults for one dashboard section."
  defmacro dsb_default(section \\ :layout) do
    schema = GroupherServer.CMS.dashboard_fields_macro_schema(section) |> Macro.escape()

    quote do
      Enum.reduce(unquote(schema), %{}, fn [k, _t, v], acc ->
        Map.put(acc, k, v)
      end)
    end
  end

  # Convert dsb metric DSL types to Ecto field types.
  # Supports list-like types in shared dsb schema definitions.
  defp to_ecto_type({:array, inner}), do: {:array, to_ecto_type(inner)}
  defp to_ecto_type(type), do: type

  # Convert dsb metric DSL types to Absinthe field/arg type AST.
  # Supports list-like types in shared dsb schema definitions.
  defp to_absinthe_type({:array, inner}, _key) do
    quote(do: list_of(unquote(to_absinthe_type(inner, nil))))
  end

  defp to_absinthe_type(:enum, :doc_cover_layout), do: :dsb_doc_cover_layout

  defp to_absinthe_type(:enum, key) when key in [:theme_preset, :theme_preset_base] do
    :dsb_theme_preset
  end

  defp to_absinthe_type(:enum, key), do: :"dsb_#{key}"
  defp to_absinthe_type(:rainbow_color, _key), do: :rainbow_color
  defp to_absinthe_type(:map, _key), do: :json
  defp to_absinthe_type(type, _key), do: type

  # Expand dashboard enum registry into GraphQL enums.
  #
  # Example:
  #   dsb_enum(:post_layout)
  #
  # Expands into:
  #   enum :dsb_post_layout do
  #     value(:quora)
  #     value(:ph)
  #   end
  #
  # Absinthe will expose QUORA / PH over GraphQL and map them back to
  # internal :quora / :ph atoms automatically.
  @doc "Declares a GraphQL enum using the dashboard setting's registered values."
  defmacro dsb_enum(enum_key) do
    values = GroupherServer.CMS.dashboard_fields_enum_values(enum_key)

    type =
      case enum_key do
        :doc_cover_layout -> :dsb_doc_cover_layout
        _ -> :"dsb_#{enum_key}"
      end

    value_defs =
      Enum.map(values, fn value ->
        quote do
          @desc unquote(get_in(@dashboard_values, [enum_key, value]))
          value(unquote(value))
        end
      end)

    quote do
      enum unquote(type) do
        (unquote_splicing(value_defs))
      end
    end
  end

  @doc "Adds values from a compile-time list to an enclosing GraphQL enum."
  defmacro enum_values(values_ast) do
    expanded = Macro.expand(values_ast, __CALLER__)

    if is_list(expanded) do
      for v <- expanded do
        quote do
          @desc unquote(Map.get(@enum_values, v))
          value(unquote(v))
        end
      end
    else
      raise ArgumentError,
            "enum_values/1 expects a compile-time list, got: #{Macro.to_string(expanded)}"
    end
  end

  @doc "Generates the GraphQL PassportAction values from the canonical Gate contract."
  defmacro passport_action_values do
    CMS.passport_actions()
    |> Enum.map(fn action ->
      enum_name = action |> String.replace(".", "_") |> String.to_existing_atom()

      quote do
        @desc unquote("Identifies the Gate action `#{action}`.")
        value(unquote(enum_name), as: unquote(action))
      end
    end)
  end

  @doc "Declares the shared identity, visibility and revision of a community article trash record."
  defmacro community_article_trash_fields do
    quote do
      @desc "ID of the community trash record."
      field(:id, non_null(:id))
      @desc "ID of the community where the article was hidden."
      field(:community_id, non_null(:id))
      @desc "Article thread of the hidden binding."
      field(:thread, non_null(:community_article_trash_thread))
      @desc "Status of this trash record."
      field(:status, non_null(:community_article_trash_status))
      @desc "Whether the article is publicly visible in this community."
      field(:public_visible, non_null(:boolean))
      @desc "Revision token for this trash record."
      field(:record_revision, non_null(:string))
      @desc "Time the trash record was created."
      field(:created_at, non_null(:datetime))
    end
  end
end
