defmodule GroupherServer.Support.Factory do
  @moduledoc """
  This module defines the mock data/func to be used by
  tests that require insert some mock data to db.

  for example you can db_insert(:user) to insert user into db
  """
  import Helper.Utils, only: [done: 1]
  import GroupherServer.CMS.Helper.Matcher

  alias GroupherServer.{Accounts, CMS, Delivery}
  alias Accounts.Model.User

  alias CMS.Model.{
    Author,
    Category,
    Community,
    Thread,
    CommunityThread,
    ArticleTag,
    Comment
  }

  @default_article_meta CMS.Model.Embeds.ArticleMeta.default_meta()
  @default_emotions CMS.Model.Embeds.CommentEmotion.default_emotions()

  # simulate editor.js fmt rich text
  def mock_rich_text(text \\ "text") do
    """
    {
      "time": 111,
      "blocks": [
        {
          "id": "lldjfiek",
          "type": "paragraph",
          "data": {
            "text": "#{text}"
          }
        }
      ],
      "version": "2.22.0"
    }
    """
  end

  # for link tasks
  def mock_rich_text(text1, text2) do
    """
    {
      "time": 111,
      "blocks": [
        {
          "id": "lldjfiek",
          "type": "paragraph",
          "data": {
            "text": "#{text1}"
          }
        },
        {
          "id": "llddiekek",
          "type": "paragraph",
          "data": {
            "text": "#{text2}"
          }
        }
      ],
      "version": "2.22.0"
    }
    """
  end

  def mock_xss_string(:safe) do
    mock_rich_text("&lt;script&gt;blackmail&lt;/script&gt;")
  end

  def mock_xss_string(text \\ "blackmail") do
    mock_rich_text("<script>alert(#{text})</script>")
  end

  def mock_comment(text \\ "comment") do
    mock_rich_text(text)
  end

  # alias CMS.Model.Post
  defp mock_meta(:post) do
    text = Faker.Lorem.sentence(10)

    %{
      meta: @default_article_meta,
      title: "post-#{String.slice(text, 1, 49)}",
      body: mock_rich_text(text),
      digest: String.slice(text, 100, 150),
      solution_digest: String.slice(text, 1, 150),
      author: mock(:author),
      # views: Enum.random(0..2000),
      views: 0,
      original_community: mock(:community),
      communities: [
        mock(:community),
        mock(:community)
      ],
      emotions: @default_emotions,
      active_at: Timex.shift(Timex.now(), seconds: -1),
      pending: 0
    }
  end

  defp mock_meta(:changelog) do
    text = Faker.Lorem.sentence(10)

    %{
      meta: @default_article_meta |> Map.merge(%{thread: "CHANGELOG"}),
      title: "changelog-#{String.slice(text, 1, 49)}",
      body: mock_rich_text(text),
      digest: String.slice(text, 100, 150),
      solution_digest: String.slice(text, 1, 150),
      length: String.length(text),
      author: mock(:author),
      # views: Enum.random(0..2000),
      views: 0,
      original_community: mock(:community),
      communities: [
        mock(:community),
        mock(:community)
      ],
      emotions: @default_emotions,
      active_at: Timex.shift(Timex.now(), seconds: -1),
      pending: 0
    }
  end

  defp mock_meta(:doc) do
    text = Faker.Lorem.sentence(10)

    %{
      meta: @default_article_meta |> Map.merge(%{thread: "DOC"}),
      title: "doc-#{String.slice(text, 1, 49)}",
      body: mock_rich_text(text),
      digest: String.slice(text, 100, 150),
      solution_digest: String.slice(text, 1, 150),
      length: String.length(text),
      author: mock(:author),
      # views: Enum.random(0..2000),
      views: 0,
      original_community: mock(:community),
      communities: [
        mock(:community),
        mock(:community)
      ],
      emotions: @default_emotions,
      active_at: Timex.shift(Timex.now(), seconds: -1),
      pending: 0
    }
  end

  defp mock_meta(:blog) do
    text = Faker.Lorem.sentence(10)

    %{
      meta: @default_article_meta |> Map.merge(%{thread: "BLOG"}),
      title: "blog-#{String.slice(text, 1, 49)}",
      body: mock_rich_text(text),
      # digest: String.slice(text, 1, 150),
      length: String.length(text),
      author: mock(:author),
      # views: Enum.random(0..2000),
      views: 0,
      original_community: mock(:community),
      communities: [
        mock(:community)
      ],
      emotions: @default_emotions,
      active_at: Timex.shift(Timex.now(), seconds: +1),
      pending: 0
    }
  end

  defp mock_meta(:comment) do
    %{body: mock_rich_text(), author: mock(:user)}
  end

  defp mock_meta(:mention) do
    unique_num = System.unique_integer([:positive, :monotonic])

    %{
      from_user: mock(:user),
      to_user: mock(:user),
      source_id: "1",
      source_type: "post",
      source_preview: "source_preview #{unique_num}."
    }
  end

  defp mock_meta(:author) do
    %{role: "normal", user: mock(:user)}
  end

  defp mock_meta(:communities_threads) do
    %{community_id: 1, thread_id: 1}
  end

  defp mock_meta(:thread) do
    unique_num = System.unique_integer([:positive, :monotonic])
    %{title: "thread #{unique_num}", slug: "thread #{unique_num}", index: :rand.uniform(20)}
  end

  defp mock_meta(:community) do
    unique_num = System.unique_integer([:positive, :monotonic])
    random_num = Enum.random(0..2000)

    title = "community_#{random_num}_#{unique_num}"

    %{
      title: title,
      aka: title,
      desc: "community desc",
      slug: title,
      logo: "https://coderplanets.oss-cn-beijing.aliyuncs.com/icons/pl/elixir.svg",
      author: mock(:user),
      locale: "en"
    }
  end

  defp mock_meta(:category) do
    unique_num = System.unique_integer([:positive, :monotonic])

    %{
      title: "category#{unique_num}",
      slug: "category#{unique_num}",
      author: mock(:author)
    }
  end

  defp mock_meta(:article_tag) do
    unique_num = System.unique_integer([:positive, :monotonic])

    %{
      title: "#{Faker.Pizza.cheese()}#{unique_num}",
      slug: "#{Faker.Pizza.cheese()}#{unique_num}",
      thread: "POST",
      color: "YELLOW",
      group: "cool",
      index: 0,
      # community: Faker.Pizza.topping(),
      community: mock(:community),
      author: mock(:author),
      extra: []
      # user_id: 1
    }
  end

  defp mock_meta(:user) do
    unique_num = System.unique_integer([:positive, :monotonic])

    %{
      login: "#{Faker.Person.first_name()}#{unique_num}" |> String.downcase(),
      nickname: "#{Faker.Person.first_name()}#{unique_num}",
      bio: Faker.Lorem.Shakespeare.romeo_and_juliet(),
      avatar: Faker.Avatar.image_url(),
      email: "faker@gmail.com",
      __schema__: nil
    }
  end

  defp mock_meta(:github_profile) do
    unique_num = System.unique_integer([:positive, :monotonic])

    %{
      id: "#{Faker.Person.first_name()} #{unique_num}",
      login: "#{Faker.Person.first_name()}#{unique_num}",
      github_id: "#{unique_num + 1000}",
      node_id: "#{unique_num + 2000}",
      access_token: "#{unique_num + 3000}",
      bio: Faker.Lorem.Shakespeare.romeo_and_juliet(),
      company: Faker.Company.name(),
      location: "chengdu",
      email: Faker.Internet.email(),
      avatar_url: Faker.Avatar.image_url(),
      html_url: Faker.Avatar.image_url(),
      followers: unique_num * unique_num,
      following: unique_num * unique_num * unique_num
    }
  end

  defp mock_meta(:oauth_profile) do
    unique_num = System.unique_integer([:positive, :monotonic])

    %{
      provider: "github",
      provider_id: unique_num |> to_string,
      login: "#{Faker.Person.first_name()}#{unique_num}",
      bio: Faker.Lorem.Shakespeare.romeo_and_juliet(),
      company: Faker.Company.name(),
      country: "",
      city: "",
      email: Faker.Internet.email(),
      nickname: "#{Faker.Person.first_name()}#{unique_num}",
      avatar: Faker.Avatar.image_url()
    }
  end

  defp mock_meta(:bill) do
    %{
      payment_usage: "donate",
      payment_method: "alipay",
      amount: 51.2,
      note: "thank you"
    }
  end

  def mock_attrs(_, attrs \\ %{})
  def mock_attrs(:user, attrs), do: mock_meta(:user) |> Map.merge(attrs)
  def mock_attrs(:author, attrs), do: mock_meta(:author) |> Map.merge(attrs)

  def mock_attrs(:community, attrs), do: mock_meta(:community) |> Map.merge(attrs)
  def mock_attrs(:thread, attrs), do: mock_meta(:thread) |> Map.merge(attrs)
  def mock_attrs(:mention, attrs), do: mock_meta(:mention) |> Map.merge(attrs)

  def mock_attrs(:communities_threads, attrs),
    do: mock_meta(:communities_threads) |> Map.merge(attrs)

  def mock_attrs(:article_tag, attrs), do: mock_meta(:article_tag) |> Map.merge(attrs)
  def mock_attrs(:category, attrs), do: mock_meta(:category) |> Map.merge(attrs)
  def mock_attrs(:github_profile, attrs), do: mock_meta(:github_profile) |> Map.merge(attrs)
  def mock_attrs(:oauth_profile, attrs), do: mock_meta(:oauth_profile) |> Map.merge(attrs)
  def mock_attrs(:bill, attrs), do: mock_meta(:bill) |> Map.merge(attrs)

  def mock_attrs(thread, attrs), do: mock_meta(thread) |> Map.merge(attrs)

  # NOTICE: avoid Recursive problem
  # this line of code will cause SERIOUS Recursive problem
  defp mock(:comment), do: Comment |> struct(mock_meta(:comment))
  defp mock(:author), do: Author |> struct(mock_meta(:author))
  defp mock(:category), do: Category |> struct(mock_meta(:category))
  defp mock(:article_tag), do: ArticleTag |> struct(mock_meta(:article_tag))

  defp mock(:user), do: User |> struct(mock_meta(:user))
  defp mock(:community), do: Community |> struct(mock_meta(:community))
  defp mock(:thread), do: Thread |> struct(mock_meta(:thread))

  defp mock(:communities_threads),
    do: CommunityThread |> struct(mock_meta(:communities_threads))

  defp mock(thread) do
    with {:ok, info} <- match(thread) do
      info.model |> struct(mock_meta(thread))
    end
  end

  defp mock(factory_name, attributes) do
    factory_name |> mock() |> struct(attributes)
  end

  # """
  # not use changeset because in test we may insert some attrs which not in schema
  # like: views, insert/update ... to test filter-sort,when ...
  # """
  def db_insert(factory_name, attributes \\ []) do
    GroupherServer.Repo.insert(mock(factory_name, attributes))
  end

  def db_insert_multi(factory_name, count, delay \\ 0) do
    results =
      Enum.reduce(1..count, [], fn _, acc ->
        Process.sleep(delay)
        {:ok, value} = db_insert(factory_name)
        acc ++ [value]
      end)

    results |> done
  end

  @images [
    "https://rmt.dogedoge.com/fetch/~/source/unsplash/photo-1557555187-23d685287bc3?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&amp;ixlib=rb-1.2.1&amp;auto=format&amp;fit=crop&amp;w=1000&amp;q=80",
    "https://rmt.dogedoge.com/fetch/~/source/unsplash/photo-1484399172022-72a90b12e3c1?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&amp;ixlib=rb-1.2.1&amp;auto=format&amp;fit=crop&amp;w=1000&amp;q=80",
    "https://images.unsplash.com/photo-1506034861661-ad49bbcf7198?ixlib=rb-1.2.1&ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&auto=format&fit=crop&w=1350&q=80",
    "https://images.unsplash.com/photo-1614607206234-f7b56bdff6e7?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=634&q=80",
    "https://images.unsplash.com/photo-1614526261139-1e5ebbd5086c?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
    "https://images.unsplash.com/photo-1614366559478-edf9d1cc4719?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=634&q=80",
    "https://images.unsplash.com/photo-1614588108027-22a021c8d8e1?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=1349&q=80",
    "https://images.unsplash.com/photo-1614522407266-ad3c5fa6bc24?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=1352&q=80",
    "https://images.unsplash.com/photo-1601933470096-0e34634ffcde?ixid=MXwxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
    "https://images.unsplash.com/photo-1614598943918-3d0f1e65c22c?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
    "https://images.unsplash.com/photo-1614542530265-7a46ededfd64?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=634&q=80"
  ]

  @doc "mock image"
  @spec mock_image(Number.t()) :: String.t()
  def mock_image(index \\ 0) do
    Enum.at(@images, index)
  end

  @doc "mock images"
  @spec mock_images(Number.t()) :: [String.t()]
  def mock_images(count \\ 1) do
    @images |> Enum.slice(0, count)
  end

  def mock_mention_for(user, from_user) do
    {:ok, post} = db_insert(:post)

    mention_attr = %{
      thread: "POST",
      title: post.title,
      article_id: post.id,
      comment_id: nil,
      block_linker: ["tmp"],
      inserted_at: post.updated_at |> DateTime.truncate(:second),
      updated_at: post.updated_at |> DateTime.truncate(:second)
    }

    mention_contents = [
      Map.merge(mention_attr, %{from_user_id: from_user.id, to_user_id: user.id})
    ]

    Delivery.send(:mention, post, mention_contents, from_user)
  end

  def mock_notification_for(user, from_user) do
    {:ok, post} = db_insert(:post)

    notify_attrs = %{
      thread: :post,
      article_id: post.id,
      title: post.title,
      action: :upvote,
      user_id: user.id,
      read: false
    }

    Delivery.send(:notify, notify_attrs, from_user)
  end

  @doc """
  mock article with default output format
  """
  def mock_article(thread) do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    attrs = mock_attrs(thread, %{community_id: community.id, author: %{user: user}})
    {:ok, article} = CMS.create_article(community, thread, attrs, user)

    {community, article, attrs, user}
  end
end
