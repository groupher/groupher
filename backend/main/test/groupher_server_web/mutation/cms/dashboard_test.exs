defmodule GroupherServer.Test.Mutation.CMS.Dashboard do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, category} = db_insert(:category)
    {:ok, user} = db_insert(:user)
    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    user_conn = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn community category user)a}
  end

  describe "[mutation cms community]" do
    @update_info_query """
    mutation($community: String!, $homepage: String, $locale: String, $title: String, $slug: String, $desc: String, $introduction: String, $logo: String, $favicon: String, $city: String, $techstack: String) {
      updateDashboardBaseInfo(community: $community, homepage: $homepage, locale: $locale, title: $title, slug: $slug, desc: $desc, introduction: $introduction, logo: $logo, favicon: $favicon, city: $city, techstack: $techstack) {
        id
        title
        locale

        dashboard {
          baseInfo {
            title
            locale
            introduction
          }
        }
      }
    }
    """
    test "update community dashboard base info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        title: "groupher",
        slug: "groupher",
        homepage: "https://groupher.com",
        desc: "thie community is awesome",
        locale: "lt",
        introduction: """
        I feel very happy writing this post. After reading this post you might feel the same as me.

        So let's know why NASA thanked India and China.

        A new study shows that two countries with the world's largest population are leading the increase in greenery on land.

        Putting photos, NASA said that there is more greenery on the Earth than 20 years ago, which has been credited by India and China.

        In the last 20 years, India and China have planted quite a lot of trees, you can see it in the picture above.

        India is breaking the world record in plantations, with 800,000 Indians planting 50 million trees in just 24 hours.

        The most important conclusion from the data is that the increase in green areas on the planet is almost entirely due to human action.

        But we do not have to stop now, I request everyone to plant some trees.
        """,
        logo: "logo",
        favicon: "favicon",
        city: "chengdu,shanghai",
        techstack: "Javascript,Elixir"
      }

      updated =
        rule_conn
        |> gq_mutation(@update_info_query, variables)

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.locale == "lt"
      assert found.dashboard.base_info.introduction |> String.length() == 828
      assert found.dashboard.base_info.title == "groupher"
      assert found.dashboard.base_info.locale == "lt"
      assert found.dashboard.base_info.desc == "thie community is awesome"
      assert found.dashboard.base_info.slug == "groupher"

      assert found.dashboard.base_info.city == "chengdu,shanghai"
      assert found.dashboard.base_info.techstack == "Javascript,Elixir"
    end

    @update_seo_query """
    mutation($community: String!, $ogTitle: String, $ogDescription: String, $seoEnable: Boolean) {
      updateDashboardSeo(community: $community, ogTitle: $ogTitle, ogDescription: $ogDescription, seoEnable: $seoEnable) {
        id
        title
        dashboard {
          seo {
            seoEnable
          }
        }
      }
    }
    """
    test "update community dashboard seo info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})
      variables = %{community: community.slug, ogTitle: "new title", seoEnable: false}

      updated = rule_conn |> gq_mutation(@update_seo_query, variables)

      assert get_in(updated, ["dashboard", "seo", "seoEnable"]) == false

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.seo.og_title == "new title"
      assert found.dashboard.seo.seo_enable == false
    end

    @update_wallpaper_query """
    mutation (
      $community: String!
      $wallpaper: String
      $wallpaperType: String
      $direction: String
      $customColorValue: String
      $bgSize: String
      $uploadBgImage: String
      $hasPattern: Boolean
      $hasBlur: Boolean
      $hasShadow: Boolean
      ) {
      updateDashboardWallpaper(
        community: $community
        wallpaper: $wallpaper
        wallpaperType: $wallpaperType
        direction: $direction
        customColorValue: $customColorValue
        bgSize: $bgSize
        uploadBgImage: $uploadBgImage
        hasPattern: $hasPattern
        hasBlur: $hasBlur
        hasShadow: $hasShadow
      ) {
        id
        title
        dashboard {
          wallpaper {
            wallpaperType
            wallpaper
          }
        }
      }
    }
    """
    test "update community dashboard wallpaper", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})
      variables = %{community: community.slug, wallpaper: "orange", wallpaperType: "CUSTOM"}

      updated =
        rule_conn
        |> gq_mutation(@update_wallpaper_query, variables)

      assert get_in(updated, ["dashboard", "wallpaper", "wallpaper"]) == "orange"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.wallpaper.wallpaper == "orange"
      assert found.dashboard.wallpaper.wallpaper_type == "CUSTOM"
    end

    @update_enable_query """
    mutation($community: String!, $post: Boolean, $changelog: Boolean) {
      updateDashboardEnable(community: $community, post: $post, changelog: $changelog) {
        id
      }
    }
    """
    test "update community dashboard enable info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})
      variables = %{community: community.slug, post: false, changelog: true}

      updated =
        rule_conn |> gq_mutation(@update_enable_query, variables)

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.enable.post == false
      assert found.dashboard.enable.changelog == true
    end

    @update_thread_emotions_query """
    mutation($community: String!, $post: [EmotionType!], $postComment: [EmotionType!], $docComment: [EmotionType!]) {
      updateDashboardThreadEmotions(
        community: $community
        post: $post
        postComment: $postComment
        docComment: $docComment
      ) {
        id
        dashboard {
          threadEmotions {
            post
            postComment
            docComment
          }
        }
      }
    }
    """
    test "update community dashboard thread emotion info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        post: ["BEER", "HEART"],
        postComment: ["HEART"],
        docComment: ["DOWNVOTE", "CONFUSED"]
      }

      updated = rule_conn |> gq_mutation(@update_thread_emotions_query, variables)
      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.thread_emotions.post == [:beer, :heart]
      assert found.dashboard.thread_emotions.post_comment == [:heart]
      assert found.dashboard.thread_emotions.doc_comment == [:downvote, :confused]
    end

    @update_layout_query """
    mutation($community: String!, $themePreset: DsbThemePreset, $themeOverwrite: Json, $textTitle: String, $textDigest: String, $postLayout: DsbPostLayout, $kanbanLayout: DsbKanbanLayout, $kanbanCardLayout: DsbKanbanCardLayout, $footerLayout: DsbFooterLayout, $topbarEnabled: Boolean, $broadcastEnable: Boolean, $kanbanBgColors: [RainbowColor], $kanbanBoards: [KanbanBoard], $glowType: String, $glowFixed: Boolean, $glowOpacity: String, $tagLayout: DsbTagLayout, $inlineTagLayout: DsbInlineTagLayout, $gaussBlur: Int, $gaussBlurDark: Int, $brandLayout: DsbBrandLayout, $communityLayout: DsbCommunityLayout, $navActiveLayout: DsbNavActiveLayout, $overlayDark: Boolean) {
      updateDashboardLayout(community: $community, themePreset: $themePreset, themeOverwrite: $themeOverwrite, textTitle: $textTitle, textDigest: $textDigest, postLayout: $postLayout, kanbanLayout: $kanbanLayout, kanbanCardLayout: $kanbanCardLayout, footerLayout: $footerLayout, topbarEnabled: $topbarEnabled, broadcastEnable: $broadcastEnable, kanbanBgColors: $kanbanBgColors, kanbanBoards: $kanbanBoards, glowType: $glowType, glowFixed: $glowFixed, glowOpacity: $glowOpacity, tagLayout: $tagLayout, inlineTagLayout: $inlineTagLayout, gaussBlur: $gaussBlur, gaussBlurDark: $gaussBlurDark, brandLayout: $brandLayout, communityLayout: $communityLayout, navActiveLayout: $navActiveLayout, overlayDark: $overlayDark) {
        id
        title
        dashboard {
          layout {
            themePreset
            themeTokens
            kanbanBoards
            footerLayout
            topbarEnabled
            tagLayout
            inlineTagLayout
            glowType
            glowFixed
            glowOpacity
            gaussBlur
            gaussBlurDark
            brandLayout
            communityLayout
            navActiveLayout
            overlayDark
            textTitle
            textDigest
          }
        }
      }
    }
    """
    test "update community dashboard layout info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themeOverwrite:
          Jason.encode!(%{
            "primaryColor" => "CUSTOM",
            "accentColor" => "YELLOW",
            "gaussBlur" => 80
          }),
        textTitle: "#112233",
        textDigest: "#667788",
        postLayout: "COVER",
        broadcastEnable: true,
        kanbanLayout: "WATERFALL",
        kanbanCardLayout: "FULL",
        footerLayout: "ONELINE",
        topbarEnabled: true,
        kanbanBgColors: ["BLACK", "YELLOW"],
        kanbanBoards: ["BACKLOG", "TODO", "DONE", "REJECTED"],
        glowType: "PINK",
        glowFixed: true,
        glowOpacity: "30",
        tagLayout: "DOT",
        inlineTagLayout: "SOFT",
        gaussBlur: 80,
        gaussBlurDark: 60,
        brandLayout: "LOGO",
        communityLayout: "SIDEBAR",
        navActiveLayout: "SOFT_BG",
        overlayDark: false
      }

      updated =
        rule_conn
        |> gq_mutation(@update_layout_query, variables)

      assert get_in(updated, ["dashboard", "layout", "navActiveLayout"]) == "SOFT_BG"
      assert get_in(updated, ["dashboard", "layout", "themePreset"]) == "CUSTOM"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "accentColor"]) ==
               "YELLOW"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "gaussBlur"]) == 80

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.theme_preset == :custom
      assert found.dashboard.layout.theme_overrides["primaryColor"] == "CUSTOM"
      assert found.dashboard.layout.post_layout == :cover
      assert found.dashboard.layout.kanban_layout == :waterfall
      assert found.dashboard.layout.kanban_card_layout == :full
      assert found.dashboard.layout.broadcast_enable == true
      assert found.dashboard.layout.kanban_bg_colors == [:black, :yellow]
      assert found.dashboard.layout.kanban_boards == [:backlog, :todo, :done, :rejected]
      assert found.dashboard.layout.footer_layout == :oneline
      assert found.dashboard.layout.topbar_enabled == true

      assert found.dashboard.layout.glow_type == "PINK"
      assert found.dashboard.layout.glow_fixed == true
      assert found.dashboard.layout.glow_opacity == "30"
      assert found.dashboard.layout.tag_layout == :dot
      assert found.dashboard.layout.inline_tag_layout == :soft
      assert found.dashboard.layout.gauss_blur == 80
      assert found.dashboard.layout.gauss_blur_dark == 60
      assert found.dashboard.layout.brand_layout == :logo
      assert found.dashboard.layout.community_layout == :sidebar
      assert found.dashboard.layout.nav_active_layout == :soft_bg
      assert found.dashboard.layout.overlay_dark == false
      assert found.dashboard.layout.text_title == "#112233"
      assert found.dashboard.layout.text_digest == "#667788"
    end

    test "update community dashboard layout should not overwrite existing settings",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        postLayout: "COVER"
      }

      updated =
        rule_conn
        |> gq_mutation(@update_layout_query, variables)

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.post_layout == :cover
      assert found.dashboard.layout.kanban_layout == :classic

      variables = %{
        community: community.slug,
        kanbanLayout: "WATERFALL"
      }

      updated =
        rule_conn
        |> gq_mutation(@update_layout_query, variables)

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.post_layout == :cover
      assert found.dashboard.layout.kanban_layout == :waterfall
    end

    test "update community dashboard layout rejects unsupported kanban board",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        kanbanBoards: ["TODO", "INVALID_BOARD"]
      }

      assert mutation_error?(rule_conn, @update_layout_query, variables)
    end

    test "update community dashboard layout rejects duplicate kanban boards",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        kanbanBoards: ["TODO", "TODO", "DONE"]
      }

      assert mutation_error?(rule_conn, @update_layout_query, variables)
    end

    @update_seo_query """
    mutation($community: String!, $rssFeedType: DsbRssFeedType, $rssFeedCount: Int) {
      updateDashboardRss(community: $community, rssFeedType: $rssFeedType, rssFeedCount: $rssFeedCount) {
        id
        title
      }
    }
    """
    test "update community dashboard rss info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        rssFeedType: "DIGEST",
        rssFeedCount: 22
      }

      updated =
        rule_conn
        |> gq_mutation(@update_seo_query, variables)

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.rss.rss_feed_type == :digest
      assert found.dashboard.rss.rss_feed_count == 22
    end

    @update_alias_query """
    mutation($community: String!, $nameAlias: [DsbAliasMap]) {
      updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {
        id
        title
      }
    }
    """
    test "update community dashboard name alias info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        nameAlias: [
          %{
            slug: "slug",
            name: "name",
            original: "original",
            group: "group"
          }
        ]
      }

      updated =
        rule_conn
        |> gq_mutation(@update_alias_query, variables)

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      found_alias = found.dashboard.name_alias |> Enum.at(0)

      assert found_alias.slug == "slug"
      assert found_alias.name == "name"
      assert found_alias.group == "group"
    end

    @update_header_links_query """
    mutation($community: String!, $headerLinks: [DsbLinkMap]) {
      updateDashboardHeaderLinks(community: $community, headerLinks: $headerLinks) {
        id
        title
        dashboard {
          headerLinks {
            id
            type
            title
            url
            links {
              id
              title
              url
            }
          }
        }
      }
    }
    """
    test "update community dashboard header links info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        headerLinks: [
          %{
            id: "link-1",
            type: "LINK",
            title: "title",
            url: "link"
          },
          %{
            id: "group-1",
            type: "GROUP",
            title: "group",
            links: [
              %{
                id: "child-1",
                title: "child",
                url: "child-link"
              }
            ]
          }
        ]
      }

      updated =
        rule_conn
        |> gq_mutation(@update_header_links_query, variables)

      first_updated = updated["dashboard"]["headerLinks"] |> List.first()
      assert first_updated["id"] == "link-1"
      assert first_updated["type"] == "LINK"
      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      link = found.dashboard.header_links |> Enum.at(0)

      assert link.title == "title"
      assert link.url == "link"

      group = found.dashboard.header_links |> Enum.at(1)
      assert group.title == "group"
      assert group.links |> List.first() |> Map.get(:url) == "child-link"
    end

    @update_footer_links_query """
    mutation($community: String!, $footerLinks: [DsbLinkMap]) {
      updateDashboardFooterLinks(community: $community, footerLinks: $footerLinks) {
        id
        title
        dashboard {
          footerLinks {
            id
            type
            title
            links {
              id
              title
              url
            }
          }
        }
      }
    }
    """
    test "update community dashboard footer links info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        footerLinks: [
          %{
            id: "group-1",
            type: "GROUP",
            title: "title",
            links: [%{id: "link-1", title: "link-title", url: "link"}]
          }
        ]
      }

      updated =
        rule_conn
        |> gq_mutation(@update_footer_links_query, variables)

      assert updated["dashboard"]["footerLinks"] |> List.first() |> Map.get("title") == "title"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      link = found.dashboard.footer_links |> Enum.at(0)

      assert link.title == "title"
      assert link.links |> List.first() |> Map.get(:url) == "link"
    end

    test "reject invalid dashboard links without clearing existing footer links",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      valid_variables = %{
        community: community.slug,
        footerLinks: [
          %{
            id: "group-1",
            type: "GROUP",
            title: "title",
            links: [%{id: "link-1", title: "link-title", url: "link"}]
          }
        ]
      }

      rule_conn |> gq_mutation(@update_footer_links_query, valid_variables)

      invalid_variables = %{
        community: community.slug,
        footerLinks: [%{id: "link-1", type: "LINK", title: "broken"}]
      }

      assert mutation_error?(rule_conn, @update_footer_links_query, invalid_variables)

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)
      assert found.dashboard.footer_links |> length() == 1
    end

    @update_footer_oneline_links_query """
    mutation($community: String!, $footerOnelineLinks: [DsbLinkChildMap]) {
      updateDashboardFooterOnelineLinks(
        community: $community,
        footerOnelineLinks: $footerOnelineLinks
      ) {
        id
        title
        dashboard {
          footerOnelineLinks {
            id
            title
            url
          }
          footerLinks {
            id
            title
          }
        }
      }
    }
    """
    test "update community dashboard footer oneline links independently", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      grouped_variables = %{
        community: community.slug,
        footerLinks: [
          %{
            id: "group-1",
            type: "GROUP",
            title: "grouped",
            links: [%{id: "grouped-link", title: "grouped-link", url: "grouped"}]
          }
        ]
      }

      rule_conn |> gq_mutation(@update_footer_links_query, grouped_variables)

      variables = %{
        community: community.slug,
        footerOnelineLinks: [
          %{id: "link-1", title: "link-title", url: "link"},
          %{id: "link-2", title: "link-title2", url: "link2"}
        ]
      }

      updated = rule_conn |> gq_mutation(@update_footer_oneline_links_query, variables)

      assert updated["dashboard"]["footerOnelineLinks"] |> length() == 2
      assert updated["dashboard"]["footerLinks"] |> List.first() |> Map.get("title") == "grouped"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.footer_oneline_links |> length() == 2
      assert found.dashboard.footer_links |> List.first() |> Map.get(:title) == "grouped"
    end

    @update_social_links_query """
    mutation($community: String!, $socialLinks: [DsbSocialLinkMap]) {
      updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {
        id
        title
        dashboard {
          socialLinks {
            type
            link
          }
        }
      }
    }
    """
    test "update community dashboard social links info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        socialLinks: [
          %{
            type: "twitter",
            link: "link"
          }
        ]
      }

      updated = rule_conn |> gq_mutation(@update_social_links_query, variables)

      assert updated["dashboard"]["socialLinks"] |> List.first() |> Map.get("type") == "twitter"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      link = found.dashboard.social_links |> Enum.at(0)

      assert link.type == "twitter"
      assert link.link == "link"
    end

    @update_media_reports_query """
    mutation($community: String!, $mediaReports: [DsbMediaReportMap]) {
      updateDashboardMediaReports(community: $community, mediaReports: $mediaReports) {
        id
        title
        dashboard {
          mediaReports {
            title
            url
          }
        }
      }
    }
    """
    test "update community dashboard media reports info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        mediaReports: [
          %{
            index: 233_344,
            title: "title",
            url: "url"
          }
        ]
      }

      updated = rule_conn |> gq_mutation(@update_media_reports_query, variables)

      assert updated["dashboard"]["mediaReports"] |> List.first() |> Map.get("title") == "title"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)
      link = found.dashboard.media_reports |> Enum.at(0)

      assert link.index == 233_344
      assert link.title == "title"
      assert link.url == "url"
    end

    @update_faqs_query """
    mutation($community: String!, $faqs: [DsbFaqMap]) {
      updateDashboardFaqs(community: $community, faqs: $faqs) {
        id
        title
        dashboard {
          faqs {
            title
            body
            index
          }
        }
      }
    }
    """
    test "update community dashboard faqs info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        faqs: [
          %{
            title: "title",
            body: "body",
            index: 0
          }
        ]
      }

      updated = rule_conn |> gq_mutation(@update_faqs_query, variables)

      assert updated["dashboard"]["faqs"] |> List.first() |> Map.get("title") == "title"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      faq = found.dashboard.faqs |> Enum.at(0)

      assert faq.title == "title"
      assert faq.body == "body"
    end
  end
end
