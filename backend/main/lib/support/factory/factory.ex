defmodule GroupherServer.Support.Factory do
  @moduledoc """
  This module defines the mock data/func to be used by
  tests that require insert some mock data to db.

  for example you can db_insert(:user) to insert user into db
  """
  import Helper.Utils, only: [done: 1]
  import GroupherServer.CMS.Helper.Matcher

  alias GroupherServer.{Accounts, CMS, Messaging}

  alias Accounts.Model.User

  alias CMS.Model.{
    Author,
    Category,
    Comment,
    Community,
    CommunityTag,
    CommunityThread,
    Thread
  }

  alias Helper.ORM

  @default_article_meta GroupherServer.CMS.Model.Embeds.ArticleMeta.default_meta()
  @default_emotions GroupherServer.CMS.Model.Embeds.CommentEmotion.default_emotions()
  @retryable_constraints ["users_login_index"]

  use GroupherServer.Support.Factory.Articles
  use GroupherServer.Support.Factory.Oauth

  def mock_xss_string(text \\ "blackmail")

  def mock_xss_string(:safe) do
    mock_rich_text("&lt;script&gt;blackmail&lt;/script&gt;")
  end

  def mock_xss_string(text) do
    mock_rich_text("<script>alert(#{text})</script>")
  end

  def mock_comment(text \\ "comment") do
    mock_rich_text(text)
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

  defp mock_meta(:community_tag) do
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
    unique_id = :rand.uniform(999_999_999)

    %{
      login: "user_#{unique_num}_#{unique_id}" |> String.downcase(),
      nickname: "User#{unique_num}_#{unique_id}",
      bio: Faker.Lorem.Shakespeare.romeo_and_juliet(),
      avatar: Faker.Avatar.image_url(),
      email: "faker_#{unique_num}_#{unique_id}@gmail.com",
      __schema__: nil
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

  def mock_attrs(:community_tag, attrs), do: mock_meta(:community_tag) |> Map.merge(attrs)
  def mock_attrs(:category, attrs), do: mock_meta(:category) |> Map.merge(attrs)
  def mock_attrs(:github_profile, attrs), do: mock_meta(:github_profile) |> Map.merge(attrs)

  def mock_attrs(:oauth_profile, attrs) do
    provider = Map.get(attrs, :provider) || Map.get(attrs, "provider") || "github"
    mock_meta({:oauth_profile, provider}) |> Map.merge(attrs)
  end

  def mock_attrs(:bill, attrs), do: mock_meta(:bill) |> Map.merge(attrs)

  def mock_attrs(thread, attrs), do: mock_meta(thread) |> Map.merge(attrs)

  # NOTICE: avoid Recursive problem
  # this line of code will cause SERIOUS Recursive problem
  defp mock(:comment), do: Comment |> struct(mock_meta(:comment))
  defp mock(:author), do: Author |> struct(mock_meta(:author))
  defp mock(:category), do: Category |> struct(mock_meta(:category))
  defp mock(:community_tag), do: CommunityTag |> struct(mock_meta(:community_tag))

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
    db_insert_with_retry(factory_name, attributes, 3)
  end

  defp db_insert_with_retry(factory_name, attributes, attempts_left) do
    try do
      GroupherServer.Repo.insert(mock(factory_name, attributes))
    rescue
      e in Ecto.ConstraintError ->
        if retryable_constraint?(e) and attempts_left > 1 do
          db_insert_with_retry(factory_name, attributes, attempts_left - 1)
        else
          reraise e, __STACKTRACE__
        end
    end
  end

  defp retryable_constraint?(%Ecto.ConstraintError{type: :unique, constraint: constraint}) do
    to_string(constraint) in @retryable_constraints
  end

  defp retryable_constraint?(_), do: false

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
  @spec mock_image(non_neg_integer()) :: String.t()
  def mock_image(index \\ 0) do
    Enum.at(@images, index)
  end

  @doc "mock images"
  @spec mock_images(non_neg_integer()) :: [String.t()]
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

    Messaging.send_mention(post, mention_contents, from_user)
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

    Messaging.send_notification(notify_attrs, from_user)
  end

  def mock_community do
    {:ok, user} = db_insert(:user)
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    CMS.Communities.create(community_attrs, user)
  end

  def mock_community(%User{} = user, attrs \\ %{}) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user}) |> Map.merge(attrs)

    CMS.Communities.create(community_attrs, user)
  end

  @doc """
  mock article with default output format
  """
  def mock_article(thread) do
    {:ok, user} = db_insert(:user)

    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    attrs = mock_attrs(thread, %{community_id: community.id, author: %{user: user}})
    {:ok, article} = CMS.Articles.create(community, thread, attrs, user)

    {community, article, attrs, user}
  end

  def mock_article(thread, preload: []), do: mock_article(thread)

  def mock_article(thread, preload: preload) do
    {community, article, attrs, user} = mock_article(thread)

    with {:ok, info} <- match(thread) do
      {:ok, preload_article} = ORM.find(info.model, article.id, preload: preload)

      {community, preload_article, attrs, user}
    end
  end

  def mock_article(thread, %Community{} = community, %User{} = user) do
    attrs = mock_attrs(thread, %{community_id: community.id, author: %{user: user}})
    {:ok, article} = CMS.Articles.create(community, thread, attrs, user)

    {community, article, attrs, user}
  end
end
