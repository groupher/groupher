defmodule GroupherServer.Test.Seeds.CommunitySeed do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias CMS.Model.Community
  alias Helper.ORM

  describe "[special communities seeds]" do
    test "can seed home community" do
      {:ok, community} = CMS.seed_community(:home)
      {:ok, found} = ORM.find(Community, community.id, preload: [threads: :thread])

      assert community.title == "Groupher"
      assert community.slug == "home"
      assert found.threads |> length == 5
    end

    # test "blackhole community" do
    #   {:ok, community} = CMS.seed_community(:blackhole)
    #   {:ok, found} = ORM.find(Community, community.id, preload: [threads: :thread])

    #   assert community.title == "黑洞"
    #   assert community.slug == "blackhole"
    #   assert found.threads |> length == 2

    #   threads = found.threads |> Enum.map(& &1.thread.title)
    #   assert threads == ["帖子", "账户"]
    # end

    test "Feedback community" do
      {:ok, community} = CMS.seed_community(:feedback)
      {:ok, found} = ORM.find(Community, community.id, preload: [threads: :thread])

      assert community.title == "反馈与建议"
      assert community.slug == "feedback"
      assert found.threads |> length == 3

      threads = found.threads |> Enum.map(& &1.thread.title)
      assert "帖子" in threads
      assert "看板" in threads
      assert "分布" in threads
    end

    # Makers,  广告墙,  求助，外包合作
    test "Makers community" do
    end

    test "Adwall community" do
    end

    test "Ask community" do
    end

    test "outwork community" do
    end
  end

  describe "[common communities seeds]" do
    # test "can seed a city community" do
    #   {:ok, community} = CMS.seed_community("chengdu", :city)
    #   {:ok, found} = ORM.find(Community, community.id, preload: [threads: :thread])

    #   filter = %{community_id: community.id, thread: "POST"}
    #   {:ok, tags} = CMS.paged_article_tags(filter)
    #   tags_titles = tags |> Enum.map(& &1.title)

    #   assert tags_titles == ["打听", "讨论", "下班后", "推荐", "二手", "吐槽", "求/转/合租", "奇奇怪怪"]

    #   assert community.title == "成都"
    #   assert community.slug == "chengdu"

    #   threads = found.threads |> Enum.map(& &1.thread.title)
    #   assert threads == ["帖子", "团队", "工作"]
    # end

    test "can seed multi lang communities" do
      {:ok, _} = CMS.seed_communities(:pl)

      {:ok, communities} = ORM.find_all(Community, %{page: 1, size: 20})

      # assert communities.total_count == 9
      radom_community = communities.entries |> Enum.random()
      {:ok, found} = ORM.find(Community, radom_community.id, preload: [threads: :thread])
      assert length(found.threads) == 3

      # filter = %{community_id: radom_community.id, thread: "POST"}
      # {:ok, tags} = CMS.paged_article_tags(filter)
      # tags_titles = tags |> Enum.map(& &1.title)
      # assert tags_titles == ["求助", "讨论", "推荐", "其他"]

      # threads = found.threads |> Enum.map(& &1.thread.title)
      # assert threads == ["帖子", "博客", "101", "awesome",  "分布", "设置"]
    end

    test "can seed a general framework community" do
      {:ok, community} = CMS.seed_community("react", :framework)
      {:ok, found} = ORM.find(Community, community.id, preload: [threads: :thread])

      filter = %{community: community.slug, thread: "POST"}
      {:ok, tags} = CMS.paged_article_tags(filter)
      tags_titles = tags |> Enum.map(& &1.title)

      assert tags_titles == ["求助", "分享推荐", "讨论", "学习资源", "杂谈", "社区事务"]

      assert community.title == "react"
      assert community.slug == "react"

      threads = found.threads |> Enum.map(& &1.thread.title)
      assert threads == ["帖子", "博客", "分布"]
    end
  end
end
