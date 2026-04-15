defmodule GroupherServer.CMS.Seeds.Tags do
  @moduledoc """
  tags seeds
  """

  alias GroupherServer.CMS

  alias CMS.Seeds.Config
  alias CMS.Model.Community
  alias Helper.T

  @tag_colors ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "grey"]
  @seed_groups ["General", "Engineering", "Resources", "Ecosystem"]
  @tag_title_zh ["排查", "经验", "讨论", "实战", "建议", "复盘", "教程", "技巧", "案例", "工具"]
  @tag_title_en [
    "debug",
    "guide",
    "discussion",
    "practice",
    "notes",
    "retrospective",
    "tips",
    "case",
    "tools",
    "design"
  ]
  @tag_count_range Config.tag_count_range()
  @group_count_range Config.group_count_range()

  def random_color, do: @tag_colors |> Enum.random() |> String.to_atom()

  @spec mock(Community.t(), atom(), keyword()) :: T.domain_res([integer()])
  def mock(%Community{} = community, thread, opts \\ [])
      when thread in [:post, :changelog, :doc, :kanban, :about] do
    count = Keyword.get(opts, :count, random_range(@tag_count_range))
    group_count = Keyword.get(opts, :group_count, random_range(@group_count_range))
    groups = @seed_groups |> Enum.take(group_count)

    with {:ok, bot} <- GroupherServer.CMS.Seeds.Helper.seed_bot(),
         {:ok, existing} <- CMS.Communities.paged_tags(tag_filter(community.id, thread)) do
      needed = max(count - length(existing.entries), 0)

      Enum.each(1..needed, fn index ->
        group = Enum.at(groups, rem(index - 1, length(groups)))
        lang = if index <= div(count, 2), do: :zh, else: :en

        title_seed =
          case lang do
            :zh -> Enum.at(@tag_title_zh, rem(index - 1, length(@tag_title_zh)))
            :en -> Enum.at(@tag_title_en, rem(index - 1, length(@tag_title_en)))
          end

        attrs = %{
          title: "#{title_seed}#{index}",
          slug: "#{thread}-#{lang}-#{index}-#{System.unique_integer([:positive, :monotonic])}",
          group: group,
          color: random_color()
        }

        CMS.Communities.create_tag(community, thread, attrs, bot)
      end)

      with {:ok, tags} <- CMS.Communities.paged_tags(tag_filter(community.id, thread)) do
        {:ok, Enum.map(tags.entries, & &1.id)}
      end
    end
  end

  defp random_range({min, max}) when is_integer(min) and is_integer(max) and min <= max,
    do: Enum.random(min..max)

  defp random_range(_), do: 10

  defp tag_filter(community_id, thread) do
    %{
      community_id: community_id,
      thread: thread,
      page: 1,
      size: 100
    }
  end

  def get(_, :map, _), do: []
  def get(_, :cper, _), do: []
  def get(_, :setting, _), do: []
  def get(_, :team, _), do: []
  def get(_, :kanban, _), do: []
  def get(_, :interview, _), do: []

  ## 首页 start

  @doc "post thread of HOME community"
  def get(_, :post, :home) do
    [
      %{
        title: "求助",
        slug: "help",
        group: "技术与人文"
      },
      %{
        slug: "tech",
        title: "技术",
        group: "技术与人文"
      },
      %{
        slug: "maker",
        title: "创作者",
        group: "技术与人文"
      },
      %{
        slug: "geek",
        title: "极客",
        group: "技术与人文"
      },
      %{
        slug: "ixd",
        title: "交互设计",
        group: "技术与人文"
      },
      %{
        slug: "df",
        title: "黑暗森林",
        group: "技术与人文"
      },
      %{
        slug: "thoughts",
        title: "迷思",
        group: "技术与人文"
      },
      %{
        slug: "city",
        title: "城市",
        group: "生活与职场"
      },
      %{
        slug: "pantry",
        title: "茶水间",
        group: "生活与职场"
      },
      %{
        slug: "afterwork",
        title: "下班后",
        group: "生活与职场"
      },
      %{
        slug: "wtf",
        title: "吐槽",
        group: "其他"
      },
      %{
        slug: "rec",
        title: "推荐",
        group: "其他"
      },
      %{
        slug: "idea",
        title: "脑洞",
        group: "其他"
      },
      %{
        slug: "feedback",
        title: "站务",
        group: "其他"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :post, color: random_color()}, attr) end)
  end

  def get(_, :blog, :home) do
    [
      %{
        title: "前端",
        slug: "web"
      },
      %{
        title: "后端开发",
        slug: "backend"
      },
      %{
        title: "apple",
        slug: "apple"
      },
      %{
        title: "Android",
        slug: "android"
      },
      %{
        title: "设计",
        slug: "design"
      },
      %{
        title: "架构",
        slug: "arch"
      },
      %{
        title: "人工智能",
        slug: "ai"
      },
      %{
        title: "运营",
        slug: "growth"
      },
      %{
        title: "生活",
        slug: "life"
      },
      %{
        title: "其他",
        slug: "others"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :blog, color: random_color()}, attr) end)
  end

  ## 首页 end

  ## Blackhole
  def get(_, :post, :blackhole) do
    [
      %{
        title: "传单",
        slug: "flyers"
      },
      %{
        title: "标题党",
        slug: "clickbait"
      },
      %{
        title: "封闭平台",
        slug: "ugly"
      },
      %{
        title: "盗版 & 侵权",
        slug: "pirate"
      },
      %{
        title: "水贴",
        slug: "cheat"
      },
      %{
        title: "无法无天",
        slug: "law"
      },
      %{
        title: "其他",
        slug: "others"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :post, color: random_color()}, attr) end)
  end

  def get(_, :account, :blackhole) do
    [
      %{
        title: "发传单",
        slug: "flyers"
      },
      %{
        title: "负能量",
        slug: "negative"
      },
      %{
        title: "滥用权限",
        slug: "ugly"
      },
      %{
        title: "无法无天",
        slug: "law"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :account, color: random_color()}, attr) end)
  end

  ## Blackhole end

  ## Feedback
  def get(_, :post, :feedback) do
    [
      %{
        title: "Bug",
        slug: "bug",
        group: "产品"
      },
      %{
        title: "功能建议",
        slug: "demand",
        group: "产品"
      },
      %{
        title: "内容审核",
        slug: "audit",
        group: "产品"
      },
      %{
        title: "编辑器",
        slug: "editor",
        group: "产品"
      },
      %{
        title: "界面交互",
        slug: "ui-ux",
        group: "产品"
      },
      %{
        title: "社区治理",
        slug: "manage",
        group: "产品"
      },
      %{
        title: "规章指南",
        slug: "intro",
        group: "其他"
      },
      %{
        title: "周报",
        slug: "devlog",
        group: "其他"
      },
      %{
        title: "其他",
        slug: "others",
        group: "其他"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :post, color: random_color()}, attr) end)
  end

  def get(_, :roadmap, :feedback), do: []

  ## Feedback end

  ## 城市
  def get(_, :post, :city) do
    [
      %{
        title: "打听",
        slug: "ask"
      },
      %{
        title: "讨论",
        slug: "hangout"
      },
      %{
        title: "下班后",
        slug: "afterwork"
      },
      %{
        title: "推荐",
        slug: "rec"
      },
      %{
        title: "二手",
        slug: "trade"
      },
      %{
        title: "吐槽",
        slug: "wtf"
      },
      %{
        title: "求/转/合租",
        slug: "rent"
      },
      %{
        title: "奇奇怪怪",
        slug: "others"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :post, color: random_color()}, attr) end)
  end

  ## 城市 end

  ## 语言与框架
  def get(_, :post, :pl), do: get(:ignore, :post, :framework)

  def get(_, :post, :framework) do
    [
      %{
        title: "求助",
        slug: "help",
        group: "技术与工程"
      },
      %{
        title: "分享推荐",
        slug: "rec",
        group: "技术与工程"
      },
      %{
        title: "讨论",
        slug: "discuss",
        group: "技术与工程"
      },
      %{
        title: "学习资源",
        slug: "tuts",
        group: "技术与工程"
      },
      %{
        title: "杂谈",
        slug: "others",
        group: "其他"
      },
      %{
        title: "社区事务",
        slug: "routine",
        group: "其他"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :post, color: random_color()}, attr) end)
  end

  def get(_, :blog, :pl) do
    get(:ignore, :blog, :framework)
  end

  def get(_, :blog, :framework) do
    [
      %{
        title: "踩坑",
        slug: "trap",
        group: "工程"
      },
      %{
        title: "技巧",
        slug: "tips",
        group: "工程"
      },
      %{
        title: "重构",
        slug: "clean-code",
        group: "工程"
      },
      %{
        title: "教程",
        slug: "tuts",
        group: "其他"
      },
      %{
        title: "生态链",
        slug: "eco",
        group: "其他"
      },
      %{
        title: "杂谈",
        slug: "others",
        group: "其他"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :blog, color: random_color()}, attr) end)
  end

  def get(_, :tut, :pl) do
    get(:ignore, :tut, :framework)
  end

  def get(_, :tut, :framework) do
    [
      %{
        title: "速查表",
        slug: "cheatsheet"
      },
      %{
        title: "Tips",
        slug: "tips"
      },
      %{
        title: "工具链",
        slug: "tooling"
      },
      %{
        title: "工具链",
        slug: "tooling"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :tut, color: random_color()}, attr) end)
  end

  def get(_, :awesome, :pl), do: []
  def get(_, :awesome, :framework), do: []

  ## 语言与框架 end

  def get(%Community{slug: "blackhole"}, :post) do
    [
      %{
        title: "传单",
        slug: "flyer"
      },
      %{
        title: "标题党",
        slug: "clickbait"
      },
      %{
        title: "封闭平台",
        slug: "ugly"
      },
      %{
        slug: "pirated",
        title: "盗版 & 侵权"
      },
      %{
        slug: "copycat",
        title: "水贴"
      },
      %{
        slug: "no-good",
        title: "坏问题"
      },
      %{
        slug: "illegal",
        title: "无法无天"
      },
      %{
        slug: "others",
        title: "其他"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :post, color: random_color()}, attr) end)
  end

  def get(%Community{slug: "makers"}, :post) do
    [
      %{
        title: "求教",
        slug: "ask",
        group: "讨论"
      },
      %{
        title: "推荐",
        slug: "rec",
        group: "讨论"
      },
      %{
        title: "生活",
        slug: "life",
        group: "讨论"
      },
      %{
        title: "脑洞",
        slug: "idea",
        group: "讨论"
      },
      %{
        title: "打招呼",
        slug: "say-hey",
        group: "讨论"
      },
      %{
        title: "技术选型",
        slug: "arch",
        group: "产品打磨"
      },
      %{
        title: "即时分享",
        slug: "share",
        group: "产品打磨"
      },
      %{
        title: "App 上架",
        slug: "app",
        group: "合规问题"
      },
      %{
        title: "合规 & 资质",
        slug: "law",
        group: "合规问题"
      },
      %{
        title: "域名",
        slug: "domain",
        group: "其他"
      },
      %{
        title: "吐槽",
        slug: "wtf",
        group: "其他"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :post, color: random_color()}, attr) end)
  end

  def get(%Community{slug: "adwall"}, :post) do
    [
      %{
        title: "产品推广",
        slug: "advertise"
      },
      %{
        title: "推荐 & 抽奖",
        slug: "discount"
      },
      %{
        title: "培训 & 课程",
        slug: "class"
      },
      %{
        title: "资料",
        slug: "collect"
      },
      %{
        title: "奇奇怪怪",
        slug: "others"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :post, color: random_color()}, attr) end)
  end
end
