import Ecto.Query

alias GroupherServer.{CMS, Repo, Support}
alias CMS.Model.{Article, ArticleBinding, ArticlePublic, Comment, Community}
alias CMS.Seeds.Helper, as: SeedHelper
alias Support.Factory

page_size = 20
page_count = 3

endpoint_config =
  Application.get_env(:groupher_server, GroupherServerWeb.Endpoint, [])
  |> Keyword.put(:server, false)

Application.put_env(:groupher_server, GroupherServerWeb.Endpoint, endpoint_config)

repo_config =
  Application.get_env(:groupher_server, GroupherServer.Repo, [])
  |> Keyword.put(:pool_size, 1)

Application.put_env(:groupher_server, GroupherServer.Repo, repo_config)

oban_config =
  Application.get_env(:groupher_server, Oban, [])
  |> Keyword.put(:testing, :manual)
  |> Keyword.put(:plugins, false)
  |> Keyword.put(:queues, false)

Application.put_env(:groupher_server, Oban, oban_config)

{:ok, _apps} = Application.ensure_all_started(:groupher_server)

Application.get_env(:groupher_server, :cache)
|> Keyword.fetch!(:pool)
|> Enum.each(fn {key, %{name: name}} ->
  if Process.whereis(name) == nil do
    {:ok, _pid} = Cachex.start_link(name, Helper.Cache.config(key))
  end
end)

Logger.configure(level: :warning)

community = Repo.get_by!(Community, slug: "home")
target_count = page_size * page_count

existing_fixture_titles =
  ArticleBinding
  |> join(:inner, [binding], article in Article, on: article.id == binding.article_id)
  |> join(:inner, [_binding, article], public in ArticlePublic,
    on: public.article_id == article.id
  )
  |> where(
    [binding, article, public],
    binding.community_id == ^community.id and binding.visible and article.thread == :post and
      like(public.title, "Pagi Browser Fixture %")
  )
  |> select([_binding, _article, public], public.title)
  |> Repo.all()
  |> MapSet.new()

{:ok, author} = SeedHelper.seed_bot()

seed_result =
  Enum.reduce_while(1..target_count, {:ok, 0}, fn index, {:ok, count} ->
    title = "Pagi Browser Fixture #{String.pad_leading(Integer.to_string(index), 3, "0")}"

    if MapSet.member?(existing_fixture_titles, title) do
      {:cont, {:ok, count}}
    else
      attrs = Factory.mock_attrs(:post, %{community_id: community.id, title: title})
      attrs = Map.put(attrs, :body_bag, Factory.mock_body_bag(attrs.body))

      case CMS.Articles.create_and_publish_article(community, :post, attrs, author,
             command_id: Ecto.UUID.generate()
           ) do
        {:ok, _published} -> {:cont, {:ok, count + 1}}
        {:error, reason} -> {:halt, {:error, {index, reason}}}
      end
    end
  end)

case seed_result do
  {:ok, added_count} ->
    article_binding =
      ArticleBinding
      |> join(:inner, [binding], public in ArticlePublic,
        on: public.article_id == binding.article_id
      )
      |> where(
        [binding, public],
        binding.community_id == ^community.id and public.title == "Pagi Browser Fixture 055"
      )
      |> select([binding, _public], binding)
      |> Repo.one!()

    article = Repo.get!(Article, article_binding.article_id)

    existing_roots =
      Repo.all(
        from(comment in Comment,
          where: comment.article_id == ^article.id and is_nil(comment.reply_to_comment_id),
          order_by: [desc: comment.id]
        )
      )

    root = List.first(existing_roots)
    missing_roots = max(target_count - length(existing_roots), 0)

    roots_result =
      Enum.reduce_while(1..max(missing_roots, 1), {:ok, {0, root}}, fn index,
                                                                       {:ok, {count, first_root}} ->
        if index > missing_roots do
          {:halt, {:ok, {count, first_root}}}
        else
          body =
            Factory.mock_comment("Pagi Browser Main Comment #{length(existing_roots) + index}")

          case CMS.Comments.create_comment(
                 community,
                 :post,
                 article_binding.inner_id,
                 body,
                 author,
                 Ecto.UUID.generate()
               ) do
            {:ok, comment} ->
              {:cont, {:ok, {count + 1, first_root || comment}}}

            {:error, reason} ->
              {:halt, {:error, {:root_comment, index, reason}}}
          end
        end
      end)

    comment_seed_result =
      with {:ok, {root_count, root}} <- roots_result,
           %Comment{} <- root do
        existing_replies =
          Repo.aggregate(
            from(comment in Comment,
              where: comment.article_id == ^article.id and comment.reply_to_comment_id == ^root.id
            ),
            :count
          )

        missing_replies = max(target_count - existing_replies, 0)

        replies_result =
          Enum.reduce_while(1..max(missing_replies, 1), {:ok, 0}, fn index, {:ok, count} ->
            if index > missing_replies do
              {:halt, {:ok, count}}
            else
              body = Factory.mock_comment("Pagi Browser Reply #{existing_replies + index}")

              case CMS.Comments.reply_comment(root.id, body, author, Ecto.UUID.generate()) do
                {:ok, _reply} -> {:cont, {:ok, count + 1}}
                {:error, reason} -> {:halt, {:error, {:reply, index, reason}}}
              end
            end
          end)

        case replies_result do
          {:ok, reply_count} -> {:ok, {root_count, reply_count}}
          {:error, reason} -> {:error, reason}
        end
      else
        {:error, reason} -> {:error, reason}
        _ -> {:error, :missing_root_comment}
      end

    case comment_seed_result do
      {:ok, {root_count, reply_count}} ->
        IO.puts("community=home")
        IO.puts("target_posts=#{target_count}")
        IO.puts("added_posts=#{added_count}")
        IO.puts("fixture_posts=#{target_count}")
        IO.puts("added_root_comments=#{root_count}")
        IO.puts("added_replies=#{reply_count}")

      {:error, reason} ->
        IO.puts("comment_seed_failed=#{inspect(reason)}")
        System.halt(1)
    end

  {:error, reason} ->
    IO.puts("seed_failed=#{inspect(reason)}")
    System.halt(1)
end
