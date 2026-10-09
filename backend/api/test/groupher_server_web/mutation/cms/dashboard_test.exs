defmodule GroupherServer.Test.Mutation.CMS.Dashboard do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, category} = db_insert(:category)
    {:ok, user} = db_insert(:user)
    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user, Ecto.UUID.generate())

    user_conn = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn community category user)a}
  end

  describe "[mutation cms community]" do
    @update_content_shadow_query S.Dsb.m(:update_dashboard_content_shadow)
    test "updates content shadow through the ordinary dashboard field path", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{"community.update" => true})

      result =
        gq_mutation(rule_conn, @update_content_shadow_query, %{
          community: community.slug,
          enabled: true
        })

      assert result["contentShadow"] == true

      shadow = gq_query(rule_conn, S.Dsb.q(:content_shadow), %{community: community.slug})

      assert shadow["dashboard"]["contentShadow"] == true
    end

    @prepare_wallpaper_upload_query S.Dsb.m(:prepare_wallpaper_upload)
    test "prepares a Wallpaper upload from typed profile input", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{"community.update" => true})
      checksum = Base.encode64(:binary.copy(<<0>>, 32))

      images =
        [
          {"wide", 1920, 1080},
          {"desktop", 1440, 900},
          {"tablet", 1024, 1366},
          {"phone", 390, 844}
        ]
        |> Enum.map(fn {profile, width, height} ->
          %{
            checksum: checksum,
            height: height,
            mimeType: "image/webp",
            profile: String.upcase(profile),
            sizeBytes: 1,
            width: width
          }
        end)

      variables = %{
        community: community.slug,
        input: %{
          baseVersion: 0,
          commandId: "typed-graphql-variants",
          images: images,
          settings: %{
            renderConfig: Jason.encode!(wallpaper_render_config()),
            settingsSchemaVersion: 1,
            source: "amber_mauve",
            type: "GRADIENT"
          },
          theme: "LIGHT"
        }
      }

      result = rule_conn |> gq_mutation(@prepare_wallpaper_upload_query, variables)

      assert is_binary(result["batchRef"])
      assert is_binary(result["batchCapability"])

      assert Enum.map(result["uploadIntents"], & &1["profile"]) ==
               ["WIDE", "DESKTOP", "TABLET", "PHONE"]
    end

    test "returns the public field-level error contract for invalid Wallpaper image metadata",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{"community.update" => true})
      checksum = Base.encode64(:binary.copy(<<0>>, 32))

      images =
        [
          {"wide", 1, 1080},
          {"desktop", 1440, 900},
          {"tablet", 1024, 1366},
          {"phone", 390, 844}
        ]
        |> Enum.map(fn {profile, width, height} ->
          %{
            checksum: checksum,
            height: height,
            mimeType: "image/webp",
            profile: String.upcase(profile),
            sizeBytes: 1,
            width: width
          }
        end)

      response =
        rule_conn
        |> post("/graphiql",
          query: @prepare_wallpaper_upload_query,
          variables: %{
            community: community.slug,
            input: %{
              baseVersion: 0,
              images: images,
              commandId: "invalid-graphql-variant-width",
              settings: %{
                renderConfig: Jason.encode!(wallpaper_render_config()),
                settingsSchemaVersion: 1,
                source: "amber_mauve",
                type: "GRADIENT"
              },
              theme: "LIGHT"
            }
          }
        )
        |> json_response(200)

      assert [error] = response["errors"]
      extensions = error["extensions"]

      assert extensions["code"] == 5716

      assert error["message"] ==
               "Wallpaper image wide has invalid width: expected 1920, got 1"

      refute Map.has_key?(error, "reason")
      refute Map.has_key?(error, "details")
      refute Map.has_key?(extensions, "reason")
      refute Map.has_key?(extensions, "details")
      refute Map.has_key?(extensions, "legacy_reason")
    end

    @update_info_query S.Dsb.m(:update_dashboard_base_info)
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

    @update_seo_query S.Dsb.m(:update_dashboard_seo)
    test "update community dashboard seo info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})
      variables = %{community: community.slug, ogTitle: "new title", seoEnable: false}

      updated = rule_conn |> gq_mutation(@update_seo_query, variables)

      assert get_in(updated, ["seo", "seoEnable"]) == false

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.seo.og_title == "new title"
      assert found.dashboard.seo.seo_enable == false
    end

    @update_enable_query S.Dsb.m(:update_dashboard_enable)
    test "update community dashboard enable info", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})
      variables = %{community: community.slug, post: false, changelog: true}

      rule_conn |> gq_mutation(@update_enable_query, variables)

      {:ok, found} = Community |> ORM.find(community.id, preload: :dashboard)

      assert found.dashboard.enable.post == false
      assert found.dashboard.enable.changelog == true
    end

    @update_thread_emotions_query S.Dsb.m(:update_dashboard_thread_emotions)
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

    @update_layout_query S.Dsb.m(:update_dashboard_layout)
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

    @update_seo_query S.Dsb.m(:update_dashboard_rss)
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

    @update_alias_query S.Dsb.m(:update_dashboard_name_alias)
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

    @update_header_links_query S.Dsb.m(:update_dashboard_header_links)
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

    @update_footer_links_query S.Dsb.m(:update_dashboard_footer_links)
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

    @update_footer_oneline_links_query S.Dsb.m(:update_dashboard_footer_oneline_links)
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

    @update_social_links_query S.Dsb.m(:update_dashboard_social_links)
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

    @update_media_reports_query S.Dsb.m(:update_dashboard_media_reports)
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

    @update_doc_faq_query S.Dsb.m(:update_dashboard_doc_faq)
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

  defp wallpaper_render_config do
    %{
      "effect" => %{"blurIntensity" => 0, "brightness" => 100, "saturation" => 100},
      "gradient" => nil,
      "pattern" => %{"enabled" => false, "id" => "01", "intensity" => 0, "tone" => "dark"},
      "texture" => %{"enabled" => false, "intensity" => 0, "params" => %{}, "type" => "noise"}
    }
  end
end
