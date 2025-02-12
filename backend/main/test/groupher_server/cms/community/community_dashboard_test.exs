defmodule GroupherServer.Test.Community.CommunityDashboard do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias CMS.Model.{Community, CommunityDashboard}

  alias Helper.ORM

  @default_dashboard CommunityDashboard.default()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})

    {:ok, ~m(user community  community_attrs)a}
  end

  describe "[community dashboard base info]" do
    test "created community should have default dashboard.", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)
      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.base_info.homepage == @default_dashboard.base_info.homepage
    end

    test "read a exist community should have default dashboard field", ~m(community)a do
      {:ok, community} = CMS.read_community(community.slug)

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert not is_nil(find_community.dashboard)
    end

    test "can update base info in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :base_info, %{
          homepage: "https://groupher.com",
          slug: "groupher"
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.base_info.homepage == "https://groupher.com"
      assert find_community.dashboard.base_info.slug == "groupher"
    end

    test "update baseinfo should update community's related fields", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :base_info, %{
          title: "new title",
          slug: "new slug"
        })

      {:ok, community} = ORM.find(Community, community.id)

      assert community.title == "new title"
      assert community.slug == "new slug"
    end

    test "update baseinfo logo should remove _tmp prefix", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :base_info, %{
          logo: "ugc/_tmp/2023-10-14/73l5_groupher.png",
          favicon: "ugc/_tmp/2023-10-14/73l5_groupher.png"
        })

      {:ok, community} = ORM.find(Community, community.id)

      assert community.logo == "ugc/2023-10-14/73l5_groupher.png"
      assert community.favicon == "ugc/2023-10-14/73l5_groupher.png"
    end

    # test "update baseinfo logo should skip persist when not in ugc/_tmp prefix",
    #      ~m(community_attrs)a do
    #   {:ok, community} = CMS.create_community(community_attrs)

    #   {:ok, _} =
    #     CMS.update_dashboard(community.slug, :base_info, %{
    #       logo: "ugc/2023-10-14/73l5_groupher.png",
    #       favicon: "ugc/2023-10-14/73l5_groupher.png"
    #     })

    #   {:ok, community} = ORM.find(Community, community.id, preload: :dashboard)

    #   assert community.logo == "ugc/2023-10-14/73l5_groupher.png"
    #   assert community.dashboard.base_info.favicon == "ugc/2023-10-14/73l5_groupher.png"
    # end

    test "can update seo in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :seo, %{
          og_title: "groupher",
          og_description: "forum sass provider"
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.seo.og_title == "groupher"
      assert find_community.dashboard.seo.og_description == "forum sass provider"
    end

    test "can update wallpaper in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :wallpaper, %{
          wallpaper_type: "custom",
          wallpaper: "orange",
          has_blur: true
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.wallpaper.wallpaper == "orange"
      assert find_community.dashboard.wallpaper.wallpaper_type == "custom"
      assert find_community.dashboard.wallpaper.has_blur == true
    end

    test "can update layout in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :layout, %{
          post_layout: "upvote_first",
          changelog_layout: "full"
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.layout.post_layout == "upvote_first"
      assert find_community.dashboard.layout.changelog_layout == "full"
    end

    test "can update rss in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :rss, %{
          rss_feed_type: "full",
          rss_feed_count: 25
        })

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.rss.rss_feed_type == "full"
      assert find_community.dashboard.rss.rss_feed_count == 25
    end

    test "can update alias in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :name_alias, [
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

    test "should overwirte all alias in community dashboard everytime", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :name_alias, [
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
        CMS.update_dashboard(community.slug, :name_alias, [
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

    test "can update header links in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :header_links, [
          %{
            title: "title",
            link: "link",
            group: "group",
            group_index: 1,
            index: 1,
            is_hot: false,
            is_new: false
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      first = find_community.dashboard.header_links |> Enum.at(0)

      assert first.title == "title"
      assert first.link == "link"
      assert first.group == "group"
      assert first.group_index == 1
    end

    test "should overwirte all header links in community dashboard everytime",
         ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :header_links, [
          %{
            title: "title",
            link: "link",
            group: "group",
            group_index: 1,
            index: 1,
            is_hot: false,
            is_new: false
          },
          %{
            title: "title2",
            link: "link2",
            group: "group2",
            group_index: 2,
            index: 2,
            is_hot: false,
            is_new: false
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.header_links |> length == 2

      first = find_community.dashboard.header_links |> Enum.at(0)
      second = find_community.dashboard.header_links |> Enum.at(1)

      assert first.title == "title"
      assert first.group_index == 1
      assert second.title == "title2"
      assert second.group_index == 2

      {:ok, _} =
        CMS.update_dashboard(community.slug, :header_links, [
          %{
            title: "title3",
            link: "link3",
            group: "group3",
            index: 1,
            is_hot: false,
            is_new: false
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)
      assert find_community.dashboard.header_links |> length == 1

      third = find_community.dashboard.header_links |> Enum.at(0)
      assert third.title == "title3"
    end

    test "can update footer links in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :footer_links, [
          %{
            title: "title",
            link: "link",
            group: "group",
            index: 1,
            is_hot: false,
            is_new: false
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      first = find_community.dashboard.footer_links |> Enum.at(0)

      assert first.title == "title"
      assert first.link == "link"
      assert first.group == "group"
    end

    test "should overwirte all footer links in community dashboard everytime",
         ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :footer_links, [
          %{
            title: "title",
            link: "link",
            group: "group",
            index: 1,
            is_hot: false,
            is_new: false
          },
          %{
            title: "title2",
            link: "link2",
            group: "group2",
            index: 2,
            is_hot: false,
            is_new: false
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)

      assert find_community.dashboard.footer_links |> length == 2

      first = find_community.dashboard.footer_links |> Enum.at(0)
      second = find_community.dashboard.footer_links |> Enum.at(1)

      assert first.title == "title"
      assert second.title == "title2"

      {:ok, _} =
        CMS.update_dashboard(community.slug, :footer_links, [
          %{
            title: "title3",
            link: "link3",
            group: "group3",
            group_index: 3,
            index: 1,
            is_hot: false,
            is_new: false
          }
        ])

      {:ok, find_community} = ORM.find(Community, community.id, preload: :dashboard)
      assert find_community.dashboard.footer_links |> length == 1

      third = find_community.dashboard.footer_links |> Enum.at(0)
      assert third.title == "title3"
      assert third.group_index == 3
    end

    test "can update media reports in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :media_reports, [
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

    test "should overwirte all media reportss in community dashboard everytime",
         ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :media_reports, [
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
        CMS.update_dashboard(community.slug, :media_reports, [
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

    test "can update faqs in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :faqs, [
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

    test "should overwirte all faqs in community dashboard everytime",
         ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :faqs, [
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
        CMS.update_dashboard(community.slug, :faqs, [
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

    test "can update social links in community dashboard", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :social_links, [
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

    test "should overwirte all social links in community dashboard everytime",
         ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} =
        CMS.update_dashboard(community.slug, :social_links, [
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
        CMS.update_dashboard(community.slug, :social_links, [
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
