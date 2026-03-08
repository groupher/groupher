defmodule GroupherServer.CMS.Seeds.Domain do
  @moduledoc """
  seeds data for init, should be called ONLY in new database, like migration
  """

  import Helper.Utils, only: [done: 1]

  import GroupherServer.CMS.Seeds.Helper,
    only: [
      threadify_communities: 2,
      tagfy_threads: 4,
      categorify_communities: 3,
      seed_bot: 0,
      seed_threads: 1,
      seed_categories_ifneed: 1,
      insert_community: 3
    ]

  alias GroupherServer.CMS

  alias CMS.Model.{Category, Community}
  alias CMS.Seeds.Communities, as: CommunitySeeds

  alias Helper.{ORM, T}

  @oss_endpoint "https://cps-oss.oss-cn-shanghai.aliyuncs.com"
  @community_types [:pl, :framework]

  @spec communities(atom()) :: T.domain_res(:ok)
  def communities(type) when type in @community_types do
    CommunitySeeds.get(type) |> Enum.each(&community(&1, type)) |> done
  end

  @spec community(atom()) :: T.domain_res(Community.t())
  def community(:home), do: seed_community(:home)
  def community(:feedback), do: seed_community(:feedback)

  @spec community(atom(), atom()) :: T.domain_res(Community.t())
  def community(slug, type) when type in @community_types do
    with {:ok, threads} <- seed_threads(type),
         {:ok, bot} <- seed_bot(),
         {:ok, categories} <- seed_categories_ifneed(bot),
         {:ok, community} <- insert_community(bot, slug, type) do
      threadify_communities([community], threads.entries)
      tagfy_threads([community], threads.entries, bot, type)
      categorify_communities([community], categories, type)

      {:ok, community}
    end
  end

  def community(_slug, _type), do: {:error, {:custom, "unknown community type"}}

  @spec set_category([atom() | String.t()], atom() | String.t()) :: T.domain_res(:ok)
  def set_category(communities_names, cat_name) when is_list(communities_names) do
    {:ok, category} = ORM.find_by(Category, %{slug: cat_name})

    Enum.each(communities_names, fn name ->
      {:ok, community} = ORM.find_by(Community, %{slug: name})

      {:ok, _} =
        CMS.Communities.set_category(%Community{id: community.id}, %Category{id: category.id})
    end)

    {:ok, :ok}
  end

  # seed community
  @spec seed_community(:blackhole | :feedback | :home) :: any
  @doc """
  seed community for home
  """
  def seed_community(:home) do
    with {:error, _} <- ORM.find_by(Community, %{slug: "home"}),
         {:ok, bot} <- seed_bot(),
         {:ok, _threads} <- seed_threads(:home) do
      _args = %{
        title: "Groupher",
        desc: "让你的产品聆听用户的声音",
        logo: "https://assets.groupher.com/communities/groupher-alpha.png",
        slug: "home",
        user_id: bot.id
      }

      # {:ok, community} = CMS.create_community(args)
      # threadify_communities([community], threads.entries)
      # tagfy_threads([community], threads.entries, bot, :home)

      # {:ok, community}
      # home 不设置分类，比较特殊
    end
  end

  def seed_community(:blackhole) do
    with {:error, _} <- ORM.find_by(Community, %{slug: "blackhole"}),
         {:ok, bot} <- seed_bot(),
         {:ok, threads} <- seed_threads(:blackhole),
         {:ok, categories} <- seed_categories_ifneed(bot) do
      args = %{
        title: "黑洞",
        desc: "这里收录不适合出现在本站的内容。",
        logo: "#{@oss_endpoint}/icons/cmd/keyboard_logo.png",
        slug: "blackhole",
        user_id: bot.id
      }

      {:ok, community} = Community |> ORM.create(args)
      threadify_communities([community], threads.entries)
      tagfy_threads([community], threads.entries, bot, :blackhole)
      categorify_communities([community], categories, :feedback)

      {:ok, community}
    end
  end

  def seed_community(:feedback) do
    with {:error, _} <- ORM.find_by(Community, %{slug: "feedback"}),
         {:ok, bot} <- seed_bot(),
         {:ok, threads} <- seed_threads(:feedback),
         {:ok, categories} <- seed_categories_ifneed(bot) do
      args = %{
        title: "反馈与建议",
        desc: "关于本站的建议和反馈请发布在这里，谢谢。",
        logo: "#{@oss_endpoint}/icons/cmd/keyboard_logo.png",
        slug: "feedback",
        user_id: bot.id
      }

      {:ok, community} = Community |> ORM.create(args)
      threadify_communities([community], threads.entries)
      tagfy_threads([community], threads.entries, bot, :feedback)
      categorify_communities([community], categories, :feedback)

      {:ok, community}
      # home 不设置分类，比较特殊
    end
  end
end
