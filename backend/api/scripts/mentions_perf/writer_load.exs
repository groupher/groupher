# Complete Article publish load against an owned, isolated local database.
unless Mix.env() == :test do
  raise "Only MIX_ENV=test is supported"
end

alias GroupherServer.{CMS, Repo}
config = Application.fetch_env!(:groupher_server, Repo)
name = System.fetch_env!("TEST_DB_NAME")

unless String.starts_with?(name, "groupher_mentions_perf_") and
         config[:database] == name and config[:hostname] in ["localhost", "127.0.0.1"] do
  raise "Requires an owned groupher_mentions_perf_* database on localhost"
end

Application.put_env(
  :groupher_server,
  Repo,
  config |> Keyword.put(:pool, DBConnection.ConnectionPool) |> Keyword.put(:pool_size, 20)
)

Logger.configure(level: :warning)
{:ok, _} = Application.ensure_all_started(:groupher_server)

defmodule MentionsPerf.WriterLoad do
  import GroupherServer.Support.Factory
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.ArticleBinding

  def run do
    if Repo.aggregate(CMS.Model.Article, :count) != 0 or
         Repo.aggregate(CMS.Model.Community, :count) != 0 do
      raise "Writer load requires an empty owned database"
    end

    {community, target, _, author} = mock_article(:blog)
    {_, focus_article, _, _} = mock_article(:post, community, author)

    binding =
      Repo.get_by!(ArticleBinding,
        article_id: focus_article.article_id,
        community_id: community.id
      )

    focus = %{type: :post, article_inner_id: Integer.to_string(binding.inner_id)}

    result = phase(community, target.article_id, author, focus)
    IO.puts(Jason.encode!(%{database: Repo.config()[:database], result: result}, pretty: true))
  end

  defp phase(community, target_id, author, focus) do
    ast = [
      %{
        "type" => "p",
        "id" => "writer-load",
        "children" => [
          %{
            "type" => "mention",
            "key" => "blog:#{target_id}",
            "value" => "Writer target",
            "children" => [%{"text" => ""}]
          }
        ]
      }
    ]

    drafts =
      for index <- 1..40 do
        {:ok, %{article: article, draft: draft}} =
          CMS.Articles.create_stable_draft(
            community,
            :post,
            %{
              title: "Writer #{index}",
              digest: "Complete publish load",
              body_bag: mock_body_bag(Jason.encode!(ast))
            },
            author
          )

        {article.id, draft.version}
      end

    chunks = Enum.chunk_every(drafts, 20)
    deadline = System.monotonic_time(:millisecond) + 14_000

    readers =
      for _ <- 1..4 do
        Task.async(fn -> reader(community.slug, focus, deadline, []) end)
      end

    writers =
      for chunk <- chunks do
        Task.async(fn ->
          Enum.map(chunk, fn {article_id, draft_version} ->
            started = System.monotonic_time(:microsecond)

            result =
              CMS.Articles.publish(article_id, author,
                community: community,
                expected_draft_version: draft_version,
                expected_lifecycle_version: 1,
                command_id: Ecto.UUID.generate()
              )

            duration = (System.monotonic_time(:microsecond) - started) / 1000
            Process.sleep(500)
            {result, duration}
          end)
        end)
      end

    write_rows = writers |> Enum.flat_map(&Task.await(&1, 60_000))
    read_rows = readers |> Enum.flat_map(&Task.await(&1, 60_000))
    write_times = for {{:ok, _}, duration} <- write_rows, do: duration
    read_times = for {{:ok, _}, duration} <- read_rows, do: duration

    %{
      writers: %{total: length(write_rows), ok: length(write_times), p95_ms: p95(write_times)},
      readers: %{total: length(read_rows), ok: length(read_times), p95_ms: p95(read_times)}
    }
  end

  defp reader(community, focus, deadline, rows) do
    if System.monotonic_time(:millisecond) < deadline do
      started = System.monotonic_time(:microsecond)
      result = CMS.mentions_graph_page(community, focus, nil, 20)
      duration = (System.monotonic_time(:microsecond) - started) / 1000
      reader(community, focus, deadline, [{result, duration} | rows])
    else
      rows
    end
  end

  defp p95([]), do: nil

  defp p95(values) do
    sorted = Enum.sort(values)
    Enum.at(sorted, ceil(length(sorted) * 0.95) - 1)
  end
end

MentionsPerf.WriterLoad.run()
