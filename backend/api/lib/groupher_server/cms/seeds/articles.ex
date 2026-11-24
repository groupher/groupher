defmodule GroupherServer.CMS.Seeds.Articles do
  @moduledoc """
  Seed helpers for inserting sample CMS articles.

  These helpers support development/demo data setup and should not be used by
  runtime write paths.

  Business position:

      Seed task
        -> Articles
        -> CMS context
        -> Repo
  """

  import GroupherServer.Support.Factory

  alias GroupherServer.CMS

  alias CMS.Communities.Tags.Maintenance
  alias CMS.Model.Community
  alias Helper.{ORM, T}
  alias CMS.Seeds.{Comments, Config, Tags}

  @article_emotions CMS.Artiment.Config.emotions() -- [:upvote, :collect]
  @article_count_range {Config.article_count_per_thread(), Config.article_count_per_thread()}
  @article_upvotes_range Config.article_upvotes_range()
  @comment_count_range Config.comment_count_range()
  @comment_upvotes_range Config.comment_upvotes_range()
  @comment_replies_range Config.comment_replies_range()
  @post_title_zh [
    "一次线上故障复盘记录",
    "这个方案在生产可行吗",
    "从零搭建服务监控实践",
    "缓存雪崩排查与修复",
    "如何优化接口响应时间",
    "数据库索引使用经验",
    "团队协作中的工程规范",
    "发布流程自动化改造",
    "日志体系设计心得",
    "复杂需求拆解方法"
  ]
  @post_title_en [
    "Production incident retrospective",
    "Is this architecture production ready",
    "Service observability from scratch",
    "Cache stampede debugging notes",
    "How we improved API latency",
    "Database indexing lessons learned",
    "Engineering standards in teams",
    "Automating the release workflow",
    "Designing a practical logging system",
    "How to break down complex requirements"
  ]

  @doc """
  Seeds one sample article into a community for the given thread.

  The community is looked up by slug and a fresh seed author is created per
  article. The article gets random views before being returned.

  ## Examples

      CMS.Seeds.Articles.mock("elixir", :post,
        command_id_factory: &Ecto.UUID.generate/0
      )

  """
  @spec mock(String.t(), atom(), keyword()) :: T.domain_res(map())
  def mock(community_slug, thread, opts)
      when is_binary(community_slug) and is_atom(thread) and is_list(opts) do
    with {:ok, community} <- ORM.find_by(Community, slug: community_slug),
         {:ok, user} <- db_insert(:user) do
      attrs = mock_attrs(thread, %{community_id: community.id, community: community})

      with {:ok, command_id} <- command_id(opts),
           {:ok, article} <- create_public_article(community, thread, attrs, user, command_id) do
        seed_views(article)
      end
    end
  end

  @spec mock(Community.t(), atom(), keyword()) :: T.domain_res([map()])
  def mock(%Community{} = community, thread, opts)
      when is_list(opts) and thread in [:post, :changelog, :doc] do
    article_range = Keyword.get(opts, :count_range, @article_count_range)
    comment_range = Keyword.get(opts, :comment_range, @comment_count_range)
    article_upvotes_range = Keyword.get(opts, :upvotes_range, @article_upvotes_range)
    comment_upvotes_range = Keyword.get(opts, :comment_upvotes_range, @comment_upvotes_range)
    replies_range = Keyword.get(opts, :replies_range, @comment_replies_range)
    count = random_range(article_range)

    tag_ids =
      case Keyword.get(opts, :tag_ids) do
        ids when is_list(ids) and ids != [] ->
          ids

        _ ->
          {:ok, ids} = Tags.mock(community, thread)
          ids
      end

    articles =
      Enum.reduce_while(1..count, {:ok, []}, fn index, {:ok, acc} ->
        {:ok, author} = db_insert(:user)

        attrs =
          mock_attrs(thread, %{community_id: community.id})
          |> maybe_put_post_title(index, count, thread)
          |> maybe_put_doc_tags(thread, tag_ids)

        with {:ok, command_id} <- command_id(opts),
             {:ok, article} <-
               create_public_article(community, thread, attrs, author, command_id) do
          article = seed_views(article)

          attach_tags(article, tag_ids)
          {:ok, article} = seed_upvotes(article, article_upvotes_range)
          {:ok, article} = seed_emotions(article)

          Comments.mock(
            community,
            thread,
            article,
            count_range: comment_range,
            upvotes_range: comment_upvotes_range,
            replies_range: replies_range,
            seed_replies: true
          )

          {:cont, {:ok, [article | acc]}}
        else
          {:error, _reason} = error -> {:halt, error}
        end
      end)

    case articles do
      {:ok, rows} -> {:ok, Enum.reverse(rows)}
      {:error, _reason} = error -> error
    end
  end

  defp command_id(opts) do
    case Keyword.get(opts, :command_id_factory) do
      factory when is_function(factory, 0) -> {:ok, factory.()}
      _ -> {:error, :command_id_factory_required}
    end
  end

  defp attach_tags(%{thread: :doc}, _ids), do: {:ok, :pass}
  defp attach_tags(_article, []), do: {:ok, :pass}

  defp attach_tags(article, tag_ids) do
    count = Enum.random(1..min(3, length(tag_ids)))

    tag_ids
    |> Enum.shuffle()
    |> Enum.take(count)
    |> Enum.with_index()
    |> Enum.each(fn {tag_id, _index} ->
      operation_ref = Ecto.UUID.generate()
      Maintenance.add(article, tag_id, operation_ref)
    end)
  end

  defp seed_upvotes(article, {min, max}) do
    target_count = Enum.random(min..max)

    if target_count > 0 do
      Enum.each(1..target_count, fn _ ->
        {:ok, user} = db_insert(:user)
        {:ok, _} = CMS.Interactions.upvote(article, user, Ecto.UUID.generate())
      end)
    end

    {:ok, article}
  end

  defp seed_upvotes(article, _) do
    seed_upvotes(article, @article_upvotes_range)
  end

  defp seed_emotions(article) do
    with {:ok, user} <- db_insert(:user),
         emotion <- Enum.random(@article_emotions),
         {:ok, _} <- CMS.Interactions.emotion(article, emotion, user, Ecto.UUID.generate()) do
      {:ok, article}
    end
  end

  defp random_range({min, max}) when is_integer(min) and is_integer(max) and min <= max do
    Enum.random(min..max)
  end

  defp random_range(_), do: Enum.random(20..30)

  defp maybe_put_post_title(attrs, _index, _count, thread) when thread != :post, do: attrs

  defp maybe_put_post_title(attrs, index, count, :post) do
    half = div(count, 2)
    lang = if index <= half, do: :zh, else: :en

    title =
      case lang do
        :zh -> Enum.at(@post_title_zh, rem(index - 1, length(@post_title_zh)))
        :en -> Enum.at(@post_title_en, rem(index - 1, length(@post_title_en)))
      end

    Map.put(attrs, :title, title)
  end

  defp seed_views(article), do: article

  defp maybe_put_doc_tags(attrs, :doc, tag_ids) do
    Map.put(attrs, :tag_ids, Enum.take(tag_ids, 3))
  end

  defp maybe_put_doc_tags(attrs, _thread, _tag_ids), do: attrs

  defp create_public_article(community, :doc, attrs, _actor, command_id) do
    owner = GroupherServer.Repo.get!(GroupherServer.Accounts.Model.User, community.user_id)
    CMS.Seeds.Docs.create(community, attrs, owner, command_id)
  end

  defp create_public_article(community, thread, attrs, actor, command_id)
       when thread in [:post, :blog, :changelog] do
    attrs =
      if is_map(Map.get(attrs, :body_bag)),
        do: attrs,
        else: Map.put(attrs, :body_bag, mock_body_bag(Map.get(attrs, :body, "")))

    with {:ok, %{article: article}} <-
           CMS.Articles.create_and_publish_article(community, thread, attrs, actor,
             command_id: command_id
           ),
         {:ok, %{inner_id: inner_id}} <-
           CMS.Articles.Bindings.fetch_binding(article.id, community.id),
         {:ok, public} <-
           CMS.FrontDesk.article(%{
             community: community.slug,
             thread: thread,
             inner_id: inner_id
           }) do
      {:ok, public}
    end
  end
end
