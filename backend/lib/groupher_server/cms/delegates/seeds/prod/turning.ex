defmodule GroupherServer.CMS.Delegate.Seeds.Prod.Turning do
  @moduledoc """
  seeds data for init, should be called ONLY in new database, like migration
  """

  import GroupherServer.Support.Factory
  import Helper.Utils, only: [done: 1, get_config: 2]
  import Ecto.Query, warn: false

  import GroupherServer.CMS.Delegate.Seeds.Helper,
    only: [
      threadify_communities: 2,
      tagfy_threads: 4,
      categorify_communities: 3,
      seed_bot: 0,
      seed_threads: 1,
      seed_categories_ifneed: 1,
      insert_community: 3
    ]

  alias Helper.ORM
  alias GroupherServer.CMS

  alias CMS.Model.{Community, Thread, Category, Post, Comment}

  @article_threads get_config(:article, :threads)
  # categories
  @community_types [:pl, :framework, :editor, :database, :devops, :city]

  @comment_emotions get_config(:article, :comment_emotions)
  # seed community

  def seed_home() do
    with {:ok, home_community} <- ORM.find_by(Community, %{slug: "home"}),
         {:ok, bot} <- seed_bot(),
         {:ok, threads} <- seed_threads(:home) do
      threadify_communities([home_community], threads.entries)
      tagfy_threads([home_community], threads.entries, bot, :home)
    end
  end

  def seed_one_community(slug, category) do
    with {:ok, threads} <- seed_threads(category),
         {:ok, bot} <- seed_bot(),
         {:ok, community} <- ORM.find_by(Community, %{slug: to_string(slug)}) do
      threadify_communities([community], threads.entries)
      tagfy_threads([community], threads.entries, bot, category)
    end
  end

  def seed_categories() do
    init_cats = [
      %{title: "编程语言", slug: "pl"},
      %{title: "框架/库", slug: "framework"},
      %{title: "开发平台", slug: "platform"},
      %{title: "设计交互", slug: "design"},
      %{title: "数据库", slug: "db"},
      %{title: "人工智能", slug: "ai"},
      %{title: "区块链", slug: "blockchain"},
      %{title: "城市", slug: "city"},
      %{title: "DevOps", slug: "devops"},
      %{title: "工具箱", slug: "toolbox"},
      %{title: "站务", slug: "community"},
      %{title: "其他", slug: "others"}
    ]

    with {:ok, bot} <- seed_bot() do
      init_cats
      |> Enum.reverse()
      |> Enum.each(fn cat ->
        {:ok, category} = CMS.create_category(cat, bot)
        Process.sleep(500)
      end)
    end
  end
end
