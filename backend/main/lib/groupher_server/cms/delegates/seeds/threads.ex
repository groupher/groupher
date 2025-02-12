defmodule GroupherServer.CMS.Delegate.Seeds.Threads do
  def get(:home) do
    [
      # %{
      #   title: "帖子",
      #   slug: "post",
      #   index: 1
      # },
      # %{
      #   title: "博客",
      #   slug: "blog",
      #   index: 3
      # },
      # %{
      #   title: "CPer",
      #   slug: "cper",
      #   index: 5
      # }
      # %{
      #   title: "设置",
      #   slug: "setting",
      #   index: 6
      # }
    ]
  end

  def get(:blackhole) do
    [
      %{
        title: "帖子",
        slug: "post",
        index: 1
      },
      %{
        title: "账户",
        slug: "account",
        index: 2
      },
      %{
        title: "博客",
        slug: "blog",
        index: 5
      }
    ]
  end

  def get(:feedback) do
    [
      %{
        title: "帖子",
        slug: "post",
        index: 1
      },
      %{
        title: "看板",
        slug: "kanban",
        index: 2
      },
      %{
        title: "分布",
        slug: "map",
        index: 3
      }
    ]
  end

  def get(:makers) do
    [
      %{
        title: "帖子",
        slug: "post",
        index: 1
      },
      %{
        title: "访谈",
        slug: "interview",
        index: 3
      }
      # %{
      #   title: "101",
      #   slug: "101",
      #   index: 4
      # },
    ]
  end

  def get(:adwall) do
    [
      %{
        title: "帖子",
        slug: "post",
        index: 1
      }
    ]
  end

  def get(:ask) do
    [
      %{
        title: "帖子",
        slug: "post",
        index: 1
      }
    ]
  end

  def get(:pl), do: get(:framework)

  # 语言，编程框架等
  def get(:framework) do
    [
      %{
        title: "帖子",
        slug: "post",
        index: 1
      },
      %{
        title: "博客",
        slug: "blog",
        index: 3
      },
      %{
        title: "分布",
        slug: "map",
        index: 8
      }
    ]
  end

  def get(:city) do
    [
      %{
        title: "帖子",
        slug: "post",
        index: 1
      },
      %{
        title: "团队",
        slug: "team",
        index: 2
      }
    ]
  end

  def get(:users), do: []
end
