defmodule GroupherServer.CMS.Seeds.Helper do
  @moduledoc false

  import ShortMaps

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{Category, Community}
  alias CMS.Artiment.Threads
  alias CMS.Seeds.SeedsConfig

  alias Helper.ORM

  @oss_endpoint "https://cps-oss.oss-cn-shanghai.aliyuncs.com"

  @categories CMS.Seeds.Categories.get()

  def tagfy_threads(communities, threads, bot, type) when is_list(communities) do
    Enum.each(communities, fn community ->
      Enum.each(threads, fn thread ->
        create_tags(community, thread, bot, type)
      end)
    end)
  end

  def create_tags(%Community{} = community, %{slug: slug}, bot, type) do
    {:ok, thread} = Threads.to_atom(slug)

    Enum.each(
      CMS.Seeds.Tags.get(community, thread, type),
      &CMS.Communities.create_tag(community, thread, &1, bot)
    )
  end

  # create tags end

  def categorify_communities(communities, categories, :editor) do
    categorify_communities(communities, categories, :tools)
  end

  # set categories to given communities
  def categorify_communities(communities, categories, part)
      when is_list(communities) and is_atom(part) do
    the_category = categories.entries |> Enum.find(fn cat -> cat.slug == Atom.to_string(part) end)

    Enum.each(communities, fn community ->
      {:ok, _} =
        CMS.Communities.set_category(%Community{id: community.id}, %Category{id: the_category.id})
    end)
  end

  # seed community end

  def seed_categories_ifneed(bot) do
    with true <- empty_in_db?(Category) do
      Enum.each(@categories, &CMS.Communities.create_category(&1, bot))
    end

    ORM.find_all(Category, %{page: 1, size: 20})
  end

  def seed_user(name) do
    nickname = name
    login = name
    avatar = "https://avatars1.githubusercontent.com/u/6184465?s=460&v=4"

    User |> ORM.upsert_by([login: login], ~m(nickname avatar login)a)
  end

  def seed_bot do
    nickname = "seed_bot_v2"
    login = "seed_bot_v2"
    avatar = "https://avatars1.githubusercontent.com/u/6184465?s=460&v=4"

    User |> ORM.upsert_by([login: login], ~m(nickname avatar login)a)
  end

  # check is the seeds alreay runed
  def empty_in_db?(queryable) do
    {:ok, results} = ORM.find_all(queryable, %{page: 1, size: 20})
    results.total_count == 0
  end

  def insert_community(bot, slug, type) do
    type = Atom.to_string(type)
    ext = if Enum.member?(SeedsConfig.svg_icons(), slug), do: "svg", else: "png"

    args = %{
      title: SeedsConfig.trans(slug),
      aka: slug,
      desc: "#{slug} is awesome!",
      logo: "#{@oss_endpoint}/icons/#{type}/#{slug}.#{ext}",
      slug: slug,
      user_id: bot.id
    }

    ORM.create(Community, args)
  end
end
