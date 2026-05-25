defmodule GroupherServer.Test.CMS.Dashboard do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.CommunityDashboard

  @default_dashboard CommunityDashboard.default()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    {:ok, ~m(user community  community_attrs)a}
  end

  describe "[community dashboard base info]" do
    test "created community should have default dashboard.", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.base_info.homepage == @default_dashboard.base_info.homepage

      assert find_community.dashboard.layout.kanban_bg_colors ==
               @default_dashboard.layout.kanban_bg_colors

      assert find_community.dashboard.layout.kanban_boards ==
               @default_dashboard.layout.kanban_boards
    end

    test "read a exist community should have default dashboard field", ~m(community)a do
      {:ok, community} = CMS.Communities.read(community.slug)

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert not is_nil(find_community.dashboard)
    end

    test "update with malformed dashboard payload returns domain error",
         ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      assert {:error, :invalid_dsb_section} = CMS.Dashboard.update(community, %{})
    end

    test "can update base info in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :base_info, %{
          homepage: "https://groupher.com",
          slug: "groupher"
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.base_info.homepage == "https://groupher.com"
      assert find_community.dashboard.base_info.slug == "groupher"
    end

    test "update base info should update community's related fields", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :base_info, %{
          title: "new title",
          slug: "new-slug"
        })

      {:ok, community} = ORM.find(Community, community.id)

      assert community.title == "new title"
      assert community.slug == "new-slug"
    end

    test "update base info should reject invalid slug format", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, before_update} = ORM.find(Community, community.id, preload: :dashboard)

      assert {:error, %Ecto.Changeset{}} =
               CMS.Dashboard.update(community, :base_info, %{
                 title: "new title",
                 slug: "new slug"
               })

      {:ok, found} = ORM.find(Community, community.id, preload: :dashboard)

      assert found.title == before_update.title
      assert found.slug == before_update.slug
      assert found.dashboard.base_info.slug == before_update.dashboard.base_info.slug
      assert found.dashboard.base_info.title == before_update.dashboard.base_info.title
    end

    test "update base info logo should keep provided path", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      asset_path = "ugc/_tmp/2023-10-14/73l5_groupher.png"

      {:ok, _} =
        CMS.Dashboard.update(community, :base_info, %{
          logo: asset_path,
          favicon: asset_path
        })

      {:ok, community} = ORM.find(Community, community.id)

      assert community.logo == asset_path
      assert community.favicon == asset_path
    end

    # test "update base info logo should skip persist when not in ugc/_tmp prefix",
    #      ~m(community_attrs user)a do
    #   {:ok, community} = CMS.Communities.create(community_attrs, user)

    #   {:ok, _} =
    #     CMS.Dashboard.update(community, :base_info, %{
    #       logo: "ugc/2023-10-14/73l5_groupher.png",
    #       favicon: "ugc/2023-10-14/73l5_groupher.png"
    #     })

    #   {:ok, community} = ORM.find(Community, community.id, preload: :dashboard)

    #   assert community.logo == "ugc/2023-10-14/73l5_groupher.png"
    #   assert community.dashboard.base_info.favicon == "ugc/2023-10-14/73l5_groupher.png"
    # end

    test "can update seo in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :seo, %{
          og_title: "groupher",
          og_description: "forum sass provider"
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.seo.og_title == "groupher"
      assert find_community.dashboard.seo.og_description == "forum sass provider"
    end

    test "can update wallpaper in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :wallpaper, %{
          type: "custom",
          source: "orange",
          has_blur: true
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.wallpaper.source == "orange"
      assert find_community.dashboard.wallpaper.type == "custom"
      assert find_community.dashboard.wallpaper.has_blur == true
    end

    test "can update layout in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :layout, %{
          post_layout: "cover",
          changelog_layout: "simple",
          topbar_enabled: true
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.layout.post_layout == :cover
      assert find_community.dashboard.layout.changelog_layout == :simple
      assert find_community.dashboard.layout.topbar_enabled == true
    end

    test "rejects unsupported kanban boards in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      assert {:error, %Ecto.Changeset{} = changeset} =
               CMS.Dashboard.update(community, :layout, %{
                 kanban_boards: [:todo, :invalid_board]
               })

      assert {:kanban_boards, {"is invalid", _}} =
               List.keyfind(changeset.errors, :kanban_boards, 0)
    end

    test "rejects duplicate kanban boards in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      assert {:error, %Ecto.Changeset{} = changeset} =
               CMS.Dashboard.update(community, :layout, %{
                 kanban_boards: [:todo, :todo, :done]
               })

      assert {:kanban_boards, {"contains duplicate kanban boards", _}} =
               List.keyfind(changeset.errors, :kanban_boards, 0)
    end

    test "rejects nil kanban boards in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      assert {:error, %Ecto.Changeset{} = changeset} =
               CMS.Dashboard.update(community, :layout, %{
                 kanban_boards: nil
               })

      assert {:kanban_boards, {"can't be blank", _}} =
               List.keyfind(changeset.errors, :kanban_boards, 0)
    end

    test "rejects empty kanban boards in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      assert {:error, %Ecto.Changeset{} = changeset} =
               CMS.Dashboard.update(community, :layout, %{
                 kanban_boards: []
               })

      assert {:kanban_boards, {"contains unsupported kanban boards", _}} =
               List.keyfind(changeset.errors, :kanban_boards, 0)
    end

    test "rejects unsupported thread emotions in community dashboard",
         ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      assert {:error, %Ecto.Changeset{} = changeset} =
               CMS.Dashboard.update(community, :thread_emotions, %{
                 post: [:beer, :invalid_emotion]
               })

      assert {:post, {"is invalid", _}} = List.keyfind(changeset.errors, :post, 0)
    end

    test "can update rss in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :rss, %{
          rss_feed_type: "full",
          rss_feed_count: 25
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.rss.rss_feed_type == :full
      assert find_community.dashboard.rss.rss_feed_count == 25
    end

    test "rss updates keep existing values when updating incrementally",
         ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :rss, %{
          rss_feed_type: "full"
        })

      {:ok, _} =
        CMS.Dashboard.update(community, :rss, %{
          rss_feed_count: 25
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.rss.rss_feed_type == :full
      assert find_community.dashboard.rss.rss_feed_count == 25
    end

    test "can update alias in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :name_alias, [
          %{
            slug: "slug",
            name: "name",
            original: "original",
            group: "group"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      first = find_community.dashboard.name_alias |> Enum.at(0)

      assert first.slug == "slug"
      assert first.name == "name"
      assert first.original == "original"
      assert first.group == "group"
    end

    test "should overwrite all alias in community dashboard every time",
         ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :name_alias, [
          %{
            slug: "slug",
            name: "name",
            original: "original",
            group: "group"
          },
          %{
            slug: "raw2",
            name: "name2",
            original: "original2",
            group: "group2"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.name_alias |> length == 2

      first = find_community.dashboard.name_alias |> Enum.at(0)
      second = find_community.dashboard.name_alias |> Enum.at(1)

      assert first.slug == "slug"
      assert second.slug == "raw2"

      {:ok, _} =
        CMS.Dashboard.update(community, :name_alias, [
          %{
            slug: "raw3",
            name: "name3",
            original: "original3",
            group: "group3"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)
      assert find_community.dashboard.name_alias |> length == 1

      third = find_community.dashboard.name_alias |> Enum.at(0)
      assert third.slug == "raw3"
    end

    test "can update header links in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :header_links, [
          %{
            id: "link-1",
            type: :link,
            title: "title",
            url: "link"
          },
          %{
            id: "group-1",
            type: :group,
            title: "group",
            links: [
              %{id: "child-1", title: "child", url: "child-link"}
            ]
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      first = find_community.dashboard.header_links |> Enum.at(0)

      assert first.title == "title"
      assert first.url == "link"

      second = find_community.dashboard.header_links |> Enum.at(1)
      assert second.title == "group"
      assert second.links |> List.first() |> Map.get(:title) == "child"
    end

    test "should overwrite all header links in community dashboard every time",
         ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :header_links, [
          %{
            id: "link-1",
            type: :link,
            title: "title",
            url: "link"
          },
          %{
            id: "link-2",
            type: :link,
            title: "title2",
            url: "link2"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.header_links |> length == 2

      first = find_community.dashboard.header_links |> Enum.at(0)
      second = find_community.dashboard.header_links |> Enum.at(1)

      assert first.title == "title"
      assert first.url == "link"
      assert second.title == "title2"
      assert second.url == "link2"

      {:ok, _} =
        CMS.Dashboard.update(community, :header_links, [
          %{
            id: "link-3",
            type: :link,
            title: "title3",
            url: "link3"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)
      assert find_community.dashboard.header_links |> length == 1

      third = find_community.dashboard.header_links |> Enum.at(0)
      assert third.title == "title3"
    end

    test "can update footer links in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :footer_links, [
          %{
            id: "group-1",
            type: :group,
            title: "title",
            links: [%{id: "link-1", title: "link-title", url: "link"}]
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      first = find_community.dashboard.footer_links |> Enum.at(0)

      assert first.title == "title"
      assert first.links |> List.first() |> Map.get(:url) == "link"
    end

    test "rejects non-list dashboard link payloads", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      assert {:error, {:custom, "invalid dashboard links"}} =
               CMS.Dashboard.update(community, :header_links, %{id: "not-list"})

      assert {:error, {:custom, "invalid dashboard links"}} =
               CMS.Dashboard.update(community, :footer_links, %{id: "not-list"})

      assert {:error, {:custom, "invalid dashboard links"}} =
               CMS.Dashboard.update(community, :footer_oneline_links, %{id: "not-list"})
    end

    test "should overwrite all footer links in community dashboard every time",
         ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :footer_links, [
          %{
            id: "group-1",
            type: :group,
            title: "title",
            links: [%{id: "link-1", title: "link-title", url: "link"}]
          },
          %{
            id: "group-2",
            type: :group,
            title: "title2",
            links: [%{id: "link-2", title: "link-title2", url: "link2"}]
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.footer_links |> length == 2

      first = find_community.dashboard.footer_links |> Enum.at(0)
      second = find_community.dashboard.footer_links |> Enum.at(1)

      assert first.title == "title"
      assert second.title == "title2"

      {:ok, _} =
        CMS.Dashboard.update(community, :footer_links, [
          %{
            id: "group-3",
            type: :group,
            title: "title3",
            links: []
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)
      assert find_community.dashboard.footer_links |> length == 1

      third = find_community.dashboard.footer_links |> Enum.at(0)
      assert third.title == "title3"
      assert third.links == []
    end

    test "can update media reports in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :media_reports, [
          %{
            title: "report title",
            favicon: "https://favicon.com",
            site_name: "site name",
            url: "https://whatever.com"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      first = find_community.dashboard.media_reports |> Enum.at(0)

      assert first.title == "report title"
      assert first.favicon == "https://favicon.com"
      assert first.site_name == "site name"
      assert first.url == "https://whatever.com"
    end

    test "should overwrite all media reports in community dashboard every time",
         ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :media_reports, [
          %{
            title: "report title",
            favicon: "https://favicon.com",
            site_name: "site name",
            url: "https://whatever.com"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      first = find_community.dashboard.media_reports |> Enum.at(0)

      assert first.title == "report title"

      {:ok, _} =
        CMS.Dashboard.update(community, :media_reports, [
          %{
            title: "report title 2",
            favicon: "https://favicon.com",
            site_name: "site name",
            url: "https://whatever.com"
          },
          %{
            title: "report title 3",
            favicon: "https://favicon.com",
            site_name: "site name",
            url: "https://whatever.com"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)
      assert find_community.dashboard.media_reports |> length == 2

      first = find_community.dashboard.media_reports |> Enum.at(0)

      assert first.title == "report title 2"
    end

    test "can update faqs in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :faqs, [
          %{
            title: "xx is yy ?",
            index: 0,
            body: "this is body"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      first = find_community.dashboard.faqs |> Enum.at(0)

      assert first.title == "xx is yy ?"
      assert first.body == "this is body"
    end

    test "should overwrite all faqs in community dashboard every time",
         ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :faqs, [
          %{
            title: "xx is yy ?",
            index: 0,
            body: "this is body"
          },
          %{
            title: "xx is yy 2 ?",
            index: 1,
            body: "this is body 2"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.faqs |> length == 2

      first = find_community.dashboard.faqs |> Enum.at(0)
      second = find_community.dashboard.faqs |> Enum.at(1)

      assert first.title == "xx is yy ?"
      assert second.title == "xx is yy 2 ?"

      {:ok, _} =
        CMS.Dashboard.update(community, :faqs, [
          %{
            title: "xx is zz ?",
            index: 0,
            body: "this is body"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)
      assert find_community.dashboard.faqs |> length == 1

      third = find_community.dashboard.faqs |> Enum.at(0)
      assert third.title == "xx is zz ?"
      assert third.body == "this is body"
    end

    test "can update social links in community dashboard", ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :social_links, [
          %{
            type: "twitter",
            link: "https://link.com"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      first = find_community.dashboard.social_links |> Enum.at(0)

      assert first.type == "twitter"
      assert first.link == "https://link.com"
    end

    test "should overwrite all social links in community dashboard every time",
         ~m(community_attrs user)a do
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Dashboard.update(community, :social_links, [
          %{
            type: "twitter",
            link: "https://link.com"
          },
          %{
            type: "zhihu",
            link: "https://zhihu.com"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.social_links |> length == 2

      first = find_community.dashboard.social_links |> Enum.at(0)
      second = find_community.dashboard.social_links |> Enum.at(1)

      assert first.type == "twitter"
      assert second.type == "zhihu"

      {:ok, _} =
        CMS.Dashboard.update(community, :social_links, [
          %{
            type: "wechat",
            link: "https://wechat.com"
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)
      assert find_community.dashboard.social_links |> length == 1

      third = find_community.dashboard.social_links |> Enum.at(0)
      assert third.type == "wechat"
      assert third.link == "https://wechat.com"
    end
  end
end
