defmodule GroupherServer.CMS.Delegate.Seeds.Tags do
  @moduledoc """
  tags seeds
  """

  alias GroupherServer.CMS
  alias CMS.Model.Community

  @tag_colors ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "grey"]

  def random_color(), do: @tag_colors |> Enum.random() |> String.to_atom()

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
        slug: "IxD",
        title: "交互设计",
        group: "技术与人文"
      },
      %{
        slug: "DF",
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
        slug: "WTF",
        title: "吐槽",
        group: "其他"
      },
      %{
        slug: "REC",
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
        slug: "UI/UX",
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
        slug: "REC"
      },
      %{
        title: "二手",
        slug: "trade"
      },
      %{
        title: "吐槽",
        slug: "WTF"
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
        slug: "REC",
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

  @doc "post thread of BLACK community"
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

  @doc "post thread of MACKERS community"
  def get(%Community{slug: "makers"}, :post) do
    [
      %{
        title: "求教",
        slug: "ask",
        group: "讨论"
      },
      %{
        title: "推荐",
        slug: "REC",
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
        slug: "WTF",
        group: "其他"
      }
    ]
    |> Enum.map(fn attr -> Map.merge(%{thread: :post, color: random_color()}, attr) end)
  end

  @doc "post thread of ADWALL community"
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
