defmodule GroupherServer.CMS.Delegate.Seeds.Categories do
  @doc """
  default categories seeds for general community
  """
  def get() do
    [
      %{
        title: "编程语言",
        slug: "pl",
        index: 0
      },
      %{
        title: "框架 & 库",
        slug: "framework",
        index: 1
      },
      %{
        title: "数据库",
        slug: "database",
        index: 2
      },
      %{
        title: "devops",
        slug: "devops",
        index: 3
      },
      %{
        title: "开发工具",
        slug: "tools",
        index: 4
      },
      %{
        title: "城市",
        slug: "city",
        index: 5
      },
      %{
        title: "人工智能",
        slug: "ai",
        index: 6
      },
      %{
        # blackhole, Feedback, dev
        title: "站务",
        slug: "feedback",
        index: 8
      },
      %{
        # Makers, Adwall, Outwork
        title: "其他",
        slug: "others",
        index: 9
      }
    ]
  end
end
