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
        baseInfo {
          title
          locale
          introduction
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

      rule_conn
      |> gq_mutation(@update_info_query, variables)

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)
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
        seo {
          seoEnable
        }
      }
    }
    """
    test "update community dashboard seo info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})
      variables = %{community: community.slug, ogTitle: "new title", seoEnable: false}

      updated = rule_conn |> gq_mutation(@update_seo_query, variables)

      assert get_in(updated, ["seo", "seoEnable"]) == false

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.seo.og_title == "new title"
      assert found.dashboard.seo.seo_enable == false
    end

    @update_wallpaper_query """
    mutation (
      $community: String!
      $wallpaper: DsbWallpaperInput!
      ) {
      updateDashboardWallpaper(
        community: $community
        wallpaper: $wallpaper
      ) {
        wallpaper {
          light {
            type
            source
            gradient
            patternId
            patternIntensity
            patternTone
            hasTexture
            blurIntensity
            brightness
            saturation
            texture
          }
          dark {
            type
            source
            gradient
            patternId
            patternIntensity
            patternTone
            hasTexture
            blurIntensity
            brightness
            saturation
            texture
          }
        }
      }
    }
    """
    test "update community dashboard wallpaper", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        wallpaper: %{
          light: %{
            source: "orange",
            type: "gradient",
            hasTexture: true,
            patternId: "02",
            patternIntensity: 65,
            patternTone: "light",
            blurIntensity: 35,
            brightness: 85,
            saturation: 120,
            gradient:
              Jason.encode!(%{
                version: 2,
                renderer: "flow",
                preset: "test",
                seed: 1,
                colors: ["#fff", "#000"],
                angle: 45,
                softness: 60,
                warp: 50,
                scale: 60,
                contrast: 100,
                brightness: 100
              }),
            texture: Jason.encode!(%{type: "ascii", intensity: 55, params: %{}})
          },
          dark: %{
            source: "purple",
            type: "gradient",
            hasTexture: true,
            patternId: "03",
            patternIntensity: 35,
            patternTone: "dark",
            blurIntensity: 15,
            brightness: 90,
            saturation: 80,
            gradient:
              Jason.encode!(%{
                version: 2,
                renderer: "linear",
                preset: "dark-test",
                colors: ["#111", "#333"],
                angle: 90,
                spread: 50
              }),
            texture: Jason.encode!(%{type: "tile", intensity: 45, params: %{}})
          }
        }
      }

      updated =
        rule_conn
        |> gq_mutation(@update_wallpaper_query, variables)

      assert get_in(updated, ["wallpaper", "light", "source"]) == "orange"
      assert get_in(updated, ["wallpaper", "dark", "source"]) == "purple"
      assert get_in(updated, ["wallpaper", "light", "patternId"]) == "02"
      assert get_in(updated, ["wallpaper", "dark", "patternId"]) == "03"
      assert get_in(updated, ["wallpaper", "light", "patternIntensity"]) == 65
      assert get_in(updated, ["wallpaper", "dark", "patternIntensity"]) == 35
      assert get_in(updated, ["wallpaper", "light", "patternTone"]) == "light"
      assert get_in(updated, ["wallpaper", "dark", "patternTone"]) == "dark"
      assert get_in(updated, ["wallpaper", "light", "hasTexture"]) == true
      assert get_in(updated, ["wallpaper", "dark", "hasTexture"]) == true
      assert get_in(updated, ["wallpaper", "light", "blurIntensity"]) == 35
      assert get_in(updated, ["wallpaper", "dark", "blurIntensity"]) == 15
      assert get_in(updated, ["wallpaper", "light", "brightness"]) == 85
      assert get_in(updated, ["wallpaper", "dark", "brightness"]) == 90
      assert get_in(updated, ["wallpaper", "light", "saturation"]) == 120
      assert get_in(updated, ["wallpaper", "dark", "saturation"]) == 80
      assert get_in(updated, ["wallpaper", "light", "gradient", "preset"]) == "test"
      assert get_in(updated, ["wallpaper", "light", "gradient", "renderer"]) == "flow"
      assert get_in(updated, ["wallpaper", "dark", "gradient", "preset"]) == "dark-test"
      assert get_in(updated, ["wallpaper", "light", "texture", "type"]) == "ascii"
      assert get_in(updated, ["wallpaper", "light", "texture", "intensity"]) == 55
      assert get_in(updated, ["wallpaper", "dark", "texture", "type"]) == "tile"
      assert get_in(updated, ["wallpaper", "dark", "texture", "intensity"]) == 45

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.wallpaper.light.source == "orange"
      assert found.dashboard.wallpaper.dark.source == "purple"
      assert found.dashboard.wallpaper.light.type == "gradient"
      assert found.dashboard.wallpaper.dark.type == "gradient"
      assert found.dashboard.wallpaper.light.has_texture == true
      assert found.dashboard.wallpaper.dark.has_texture == true
      assert found.dashboard.wallpaper.light.pattern_id == "02"
      assert found.dashboard.wallpaper.dark.pattern_id == "03"
      assert found.dashboard.wallpaper.light.pattern_intensity == 65
      assert found.dashboard.wallpaper.dark.pattern_intensity == 35
      assert found.dashboard.wallpaper.light.pattern_tone == "light"
      assert found.dashboard.wallpaper.dark.pattern_tone == "dark"
      assert found.dashboard.wallpaper.light.blur_intensity == 35
      assert found.dashboard.wallpaper.dark.blur_intensity == 15
      assert found.dashboard.wallpaper.light.brightness == 85
      assert found.dashboard.wallpaper.dark.brightness == 90
      assert found.dashboard.wallpaper.light.saturation == 120
      assert found.dashboard.wallpaper.dark.saturation == 80
      assert found.dashboard.wallpaper.light.gradient["preset"] == "test"
      assert found.dashboard.wallpaper.light.gradient["renderer"] == "flow"
      assert found.dashboard.wallpaper.dark.gradient["preset"] == "dark-test"
      assert found.dashboard.wallpaper.light.texture["type"] == "ascii"
      assert found.dashboard.wallpaper.light.texture["intensity"] == 55
      assert found.dashboard.wallpaper.dark.texture["type"] == "tile"
      assert found.dashboard.wallpaper.dark.texture["intensity"] == 45

      updated =
        rule_conn
        |> gq_mutation(@update_wallpaper_query, %{
          community: community.slug,
          wallpaper: %{
            light: %{texture: Jason.encode!(%{type: "dots", intensity: 42, params: %{}})}
          }
        })

      assert get_in(updated, ["wallpaper", "light", "texture", "type"]) == "dots"
      assert get_in(updated, ["wallpaper", "light", "texture", "intensity"]) == 42

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.wallpaper.light.texture["type"] == "dots"
      assert found.dashboard.wallpaper.light.texture["intensity"] == 42

      updated =
        rule_conn
        |> gq_mutation(@update_wallpaper_query, %{
          community: community.slug,
          wallpaper: %{
            light: %{texture: Jason.encode!(%{type: "oil", intensity: 68, params: %{}})}
          }
        })

      assert get_in(updated, ["wallpaper", "light", "texture", "type"]) == "oil"
      assert get_in(updated, ["wallpaper", "light", "texture", "intensity"]) == 68

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.wallpaper.light.texture["type"] == "oil"
      assert found.dashboard.wallpaper.light.texture["intensity"] == 68
    end

    @update_enable_query """
    mutation($community: String!, $post: Boolean, $changelog: Boolean) {
      updateDashboardEnable(community: $community, post: $post, changelog: $changelog) {
        enable {
          post
          changelog
        }
      }
    }
    """
    test "update community dashboard enable info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})
      variables = %{community: community.slug, post: false, changelog: true}

      rule_conn |> gq_mutation(@update_enable_query, variables)

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

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
        threadEmotions {
          post
          postComment
          docComment
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

      rule_conn |> gq_mutation(@update_thread_emotions_query, variables)
      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.thread_emotions.post == [:beer, :heart]
      assert found.dashboard.thread_emotions.post_comment == [:heart]
      assert found.dashboard.thread_emotions.doc_comment == [:downvote, :confused]
    end

    @update_layout_query """
    mutation($community: String!, $postLayout: DsbPostLayout, $kanbanLayout: DsbKanbanLayout, $kanbanCardLayout: DsbKanbanCardLayout, $footerLayout: DsbFooterLayout, $topbarEnabled: Boolean, $broadcastEnable: Boolean, $kanbanBgColors: [RainbowColor], $kanbanBoards: [KanbanBoard], $tagLayout: DsbTagLayout, $inlineTagLayout: DsbInlineTagLayout, $brandLayout: DsbBrandLayout, $communityLayout: DsbCommunityLayout, $navActiveLayout: DsbNavActiveLayout, $overlayDark: Boolean) {
      updateDashboardLayout(community: $community, postLayout: $postLayout, kanbanLayout: $kanbanLayout, kanbanCardLayout: $kanbanCardLayout, footerLayout: $footerLayout, topbarEnabled: $topbarEnabled, broadcastEnable: $broadcastEnable, kanbanBgColors: $kanbanBgColors, kanbanBoards: $kanbanBoards, tagLayout: $tagLayout, inlineTagLayout: $inlineTagLayout, brandLayout: $brandLayout, communityLayout: $communityLayout, navActiveLayout: $navActiveLayout, overlayDark: $overlayDark) {
        layout {
          kanbanBoards
          footerLayout
          topbarEnabled
          tagLayout
          inlineTagLayout
          brandLayout
          communityLayout
          navActiveLayout
          overlayDark
        }
      }
    }
    """
    test "update community dashboard layout info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        postLayout: "COVER",
        broadcastEnable: true,
        kanbanLayout: "WATERFALL",
        kanbanCardLayout: "FULL",
        footerLayout: "ONELINE",
        topbarEnabled: true,
        kanbanBgColors: ["BLACK", "YELLOW"],
        kanbanBoards: ["BACKLOG", "TODO", "DONE", "REJECTED"],
        tagLayout: "DOT",
        inlineTagLayout: "SOFT",
        brandLayout: "LOGO",
        communityLayout: "SIDEBAR",
        navActiveLayout: "SOFT_BG",
        overlayDark: false
      }

      updated =
        rule_conn
        |> gq_mutation(@update_layout_query, variables)

      assert get_in(updated, ["layout", "navActiveLayout"]) == "SOFT_BG"

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.layout.post_layout == :cover
      assert found.dashboard.layout.kanban_layout == :waterfall
      assert found.dashboard.layout.kanban_card_layout == :full
      assert found.dashboard.layout.broadcast_enable == true
      assert found.dashboard.layout.kanban_bg_colors == [:black, :yellow]
      assert found.dashboard.layout.kanban_boards == [:backlog, :todo, :done, :rejected]
      assert found.dashboard.layout.footer_layout == :oneline
      assert found.dashboard.layout.topbar_enabled == true

      assert found.dashboard.layout.tag_layout == :dot
      assert found.dashboard.layout.inline_tag_layout == :soft
      assert found.dashboard.layout.brand_layout == :logo
      assert found.dashboard.layout.community_layout == :sidebar
      assert found.dashboard.layout.nav_active_layout == :soft_bg
      assert found.dashboard.layout.overlay_dark == false
    end

    test "update community dashboard layout should not overwrite existing settings",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        postLayout: "COVER"
      }

      rule_conn
      |> gq_mutation(@update_layout_query, variables)

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.layout.post_layout == :cover
      assert found.dashboard.layout.kanban_layout == :classic

      variables = %{
        community: community.slug,
        kanbanLayout: "WATERFALL"
      }

      rule_conn
      |> gq_mutation(@update_layout_query, variables)

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

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
        rss {
          rssFeedType
          rssFeedCount
        }
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

      rule_conn
      |> gq_mutation(@update_seo_query, variables)

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.rss.rss_feed_type == :digest
      assert found.dashboard.rss.rss_feed_count == 22
    end

    @update_alias_query """
    mutation($community: String!, $nameAlias: [DsbAliasMap]) {
      updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {
        nameAlias {
          slug
          name
          original
          group
        }
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

      rule_conn
      |> gq_mutation(@update_alias_query, variables)

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      found_alias = found.dashboard.name_alias |> Enum.at(0)

      assert found_alias.slug == "slug"
      assert found_alias.name == "name"
      assert found_alias.group == "group"
    end

    @update_header_links_query """
    mutation($community: String!, $headerLinks: [DsbLinkMap]) {
      updateDashboardHeaderLinks(community: $community, headerLinks: $headerLinks) {
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

      first_updated = updated["headerLinks"] |> List.first()
      assert first_updated["id"] == "link-1"
      assert first_updated["type"] == "LINK"
      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

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

      assert updated["footerLinks"] |> List.first() |> Map.get("title") == "title"

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

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

      assert updated["footerOnelineLinks"] |> length() == 2
      assert updated["footerLinks"] |> List.first() |> Map.get("title") == "grouped"

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.footer_oneline_links |> length() == 2
      assert found.dashboard.footer_links |> List.first() |> Map.get(:title) == "grouped"
    end

    @update_social_links_query """
    mutation($community: String!, $socialLinks: [DsbSocialLinkMap]) {
      updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {
        socialLinks {
          type
          link
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

      assert updated["socialLinks"] |> List.first() |> Map.get("type") == "twitter"

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      link = found.dashboard.social_links |> Enum.at(0)

      assert link.type == "twitter"
      assert link.link == "link"
    end

    @update_media_reports_query """
    mutation($community: String!, $mediaReports: [DsbMediaReportMap]) {
      updateDashboardMediaReports(community: $community, mediaReports: $mediaReports) {
        mediaReports {
          title
          url
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

      assert updated["mediaReports"] |> List.first() |> Map.get("title") == "title"

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)
      link = found.dashboard.media_reports |> Enum.at(0)

      assert link.index == 233_344
      assert link.title == "title"
      assert link.url == "url"
    end

    @update_doc_faq_query """
    mutation($community: String!, $docFaq: DsbDocFaqInput!) {
      updateDashboardDocFaq(community: $community, docFaq: $docFaq) {
        docFaq {
          title
          desc
          groupedView
          groupItems {
            id
            title
            index
            items {
              id
              title
              detail
              index
            }
          }
          flatItems {
            id
            title
            detail
            index
          }
        }
      }
    }
    """
    test "update community dashboard docs FAQ info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        docFaq: %{
          title: "FAQ",
          desc: "Common docs questions",
          groupedView: true,
          groupItems: [
            %{
              id: "grp_basics",
              title: "Basics",
              index: 0,
              items: [
                %{
                  id: "faq_intro",
                  title: "What is docs?",
                  detail: "Docs are product help content.",
                  index: 0
                }
              ]
            }
          ],
          flatItems: []
        }
      }

      updated = rule_conn |> gq_mutation(@update_doc_faq_query, variables)

      assert updated["docFaq"]["title"] == "FAQ"
      assert updated["docFaq"]["groupItems"] |> List.first() |> Map.get("title") == "Basics"

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      faq = found.dashboard.doc_faq
      group = faq.group_items |> Enum.at(0)
      item = group.items |> Enum.at(0)

      assert faq.title == "FAQ"
      assert faq.desc == "Common docs questions"
      assert item.detail == "Docs are product help content."
    end
  end
end
