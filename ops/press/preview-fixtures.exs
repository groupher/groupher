unless System.get_env("PHX_HOST") == "groupher-press-preview-api.fly.dev" and
         URI.parse(System.fetch_env!("DATABASE_URL")).path == "/groupher_preview" do
  raise "Press fixtures require the isolated preview Phoenix app and database"
end

defmodule GroupherServer.PressPreview.SearchSink do
  @moduledoc "Search provider sink used only by the isolated Press acceptance fixture."
  @behaviour GroupherServer.CMS.SearchArtiments.PlatformAdapter

  def upsert(_articles, _opts), do: {:ok, :pass}
  def delete(_refs), do: {:ok, :pass}
  def update_metrics(_updates), do: {:ok, :pass}
  def search(_query), do: {:error, :search_outside_press_acceptance}
end

defmodule GroupherServer.PressPreview.Fixtures do
  @moduledoc "Creates and transitions synthetic content for live Press acceptance."

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Support.Factory

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    Community,
    DocLifecycle,
    DocPublic,
    DocTreeNode
  }

  @slug "press-preview"

  def seed do
    with_search_sink(fn ->
      Repo.transaction(fn ->
        community =
          case Repo.get_by(Community, slug: @slug) do
            nil ->
              {:ok, user} =
                Factory.db_insert(:user, login: "press-preview", nickname: "Press Preview")

              {:ok, community} =
                Factory.mock_community(user, %{
                  slug: @slug,
                  aka: @slug,
                  title: "Press Preview"
                })

              for thread <- [:post, :blog, :changelog, :doc] do
                {_, article, _, _} = Factory.mock_article(thread, community, user)

                if thread == :doc do
                  for attrs <- [
                        %{node_id: "press-tab", type: :tab, title: "Docs", index: 0},
                        %{
                          node_id: "press-group",
                          parent_node_id: "press-tab",
                          type: :group,
                          title: "Guide",
                          index: 0
                        },
                        %{
                          node_id: "press-page",
                          parent_node_id: "press-group",
                          doc_id: article.id,
                          type: :page,
                          title: article.title,
                          index: 0
                        }
                      ] do
                    %DocTreeNode{}
                    |> DocTreeNode.changeset(
                      Map.merge(attrs, %{
                        community_id: community.id,
                        branch_id: article.branch_id,
                        stage: :public
                      })
                    )
                    |> Repo.insert!()
                  end
                end
              end

              {:ok, _config} =
                CMS.Press.update_config(
                  community,
                  %{
                    feed_enabled: true,
                    feed_count: 5,
                    feed_threads: [:post, :blog, :changelog, :doc]
                  },
                  user,
                  Ecto.UUID.generate()
                )

              community

            community ->
              community
          end

        snapshot(community)
      end)
    end)
  end

  def snapshot(community \\ Repo.get_by!(Community, slug: @slug)) do
    articles =
      Repo.all(
        from(article in Article,
          join: binding in ArticleBinding,
          on: binding.article_id == article.id,
          where: binding.community_id == ^community.id,
          order_by: binding.inner_id,
          select: %{id: article.id, thread: article.thread, inner_id: binding.inner_id}
        )
      )

    %{community: community.slug, community_id: community.id, articles: articles}
  end

  def hold(thread) do
    with_search_sink(fn ->
      result =
        Repo.transaction(fn ->
          lifecycle = locked_lifecycle(thread)
          source_ref = "press-preview-#{Ecto.UUID.generate()}"

          {:ok, restriction} =
            CMS.ReviewBlocks.apply(lifecycle, %{
              scope_key: "platform",
              type: :manual_hold,
              source_ref: source_ref,
              source: :human,
              applied_at: DateTime.utc_now(:second)
            })

          %{
            thread: thread,
            restriction_id: restriction.id,
            operation_ref: source_ref,
            transitions: 1
          }
        end)

      acknowledge_transition(result)
    end)
  end

  def restore(thread) do
    with_search_sink(fn ->
      result =
        Repo.transaction(fn ->
          lifecycle = locked_lifecycle(thread)
          {:ok, restrictions} = CMS.ReviewBlocks.active_for(lifecycle, "platform")

          restrictions =
            Enum.filter(restrictions, &String.starts_with?(&1.source_ref || "", "press-preview-"))

          operation_ref = Ecto.UUID.generate()

          {:ok, :pass} =
            CMS.ReviewBlocks.end_blocks(
              lifecycle,
              "platform",
              Enum.map(restrictions, & &1.id),
              operation_ref,
              "review_approved"
            )

          %{thread: thread, operation_ref: operation_ref, transitions: length(restrictions)}
        end)

      acknowledge_transition(result)
    end)
  end

  def probe do
    # Derive expected visibility from Phoenix, never from the observed HTTP status.
    {:ok, doc_feed} = CMS.Press.thread_rss_feed(@slug, :doc)
    {:ok, feed} = CMS.Press.community_rss_feed(@slug)

    expectations = [
      {"post/1.md", article_status(:post, 1), nil},
      {"doc/4.md", article_status(:doc, 4), nil},
      {"doc/feed.xml", 200, length(doc_feed.items)},
      {"feed.json", 200, length(feed.items)}
    ]

    results =
      for {path, status, count} <- expectations do
        response =
          Req.get!("https://edge-router-preview.groupher.workers.dev/#{@slug}/#{path}",
            decode_body: false,
            receive_timeout: 30_000,
            retry: false
          )

        actual_count =
          case {path, response.status} do
            {"doc/feed.xml", 200} -> length(Regex.scan(~r/<item>/, response.body))
            {"feed.json", 200} -> length(Jason.decode!(response.body)["items"])
            _ -> nil
          end

        %{
          path: path,
          status: response.status,
          expected_status: status,
          cf_ray: List.first(Req.Response.get_header(response, "cf-ray")),
          doc_feed_items: if(path == "doc/feed.xml", do: actual_count),
          feed_items: if(path == "feed.json", do: actual_count),
          passed: response.status == status and actual_count == count
        }
      end

    if Enum.all?(results, & &1.passed),
      do: {:ok, results},
      else: {:error, %{reason: :unexpected_press_output, results: results}}
  end

  defp article_status(thread, inner_id) do
    case CMS.Press.article(%{community: @slug, thread: thread, inner_id: inner_id}) do
      {:ok, _} -> 200
      {:error, %{reason: reason}} when reason in [:not_exist, :article_not_found] -> 404
      other -> raise "Unexpected Phoenix projection: #{inspect(other)}"
    end
  end

  defp with_search_sink(fun) do
    :global.trans({{__MODULE__, :search_sink}, self()}, fn ->
      previous = Application.fetch_env!(:groupher_server, :search_artiments)

      queues =
        for queue <- [:cms_outbox, :press, :search, :public_cache],
            state = Oban.check_queue(queue: queue),
            state != nil,
            do: {queue, state.paused}

      if length(queues) != 4 and Oban.config().testing != :manual do
        raise "Fixture requires all four local Outbox queues in the isolated single-node preview"
      end

      result =
        try do
          for {queue, _} <- queues, do: :ok = Oban.pause_queue(queue: queue, local_only: true)
          await_paused(queues, System.monotonic_time(:millisecond) + 20_000)

          Application.put_env(
            :groupher_server,
            :search_artiments,
            Keyword.put(previous, :platform, GroupherServer.PressPreview.SearchSink)
          )

          fun.()
        after
          # Retire only this synthetic community's remaining jobs, even on exceptions.
          # If cleanup fails, leave queues paused rather than deliver with a real adapter.
          try do
            retire_fixture_jobs()
          after
            Application.put_env(:groupher_server, :search_artiments, previous)
          end

          for {queue, was_paused} <- queues,
              not was_paused,
              do: :ok = Oban.resume_queue(queue: queue, local_only: true)

          await_restored(queues, System.monotonic_time(:millisecond) + 20_000)
        end

      case result do
        {:ok, data} when is_map(data) ->
          {:ok,
           Map.put(data, :queues, %{
             before: Map.new(queues),
             after: queue_states(queues),
             confirmed: true
           })}

        other ->
          other
      end
    end)
  end

  defp await_paused(queues, deadline) do
    quiet =
      Enum.all?(queues, fn {queue, _} ->
        case Oban.check_queue(queue: queue) do
          %{paused: true, running: []} -> true
          _ -> false
        end
      end)

    cond do
      quiet ->
        :ok

      System.monotonic_time(:millisecond) < deadline ->
        Process.sleep(50)
        await_paused(queues, deadline)

      true ->
        raise "Preview queues did not quiesce before Search sink installation"
    end
  end

  defp queue_states(queues) do
    Map.new(queues, fn {queue, _} ->
      state = Oban.check_queue(queue: queue)
      {queue, if(state, do: state.paused, else: :missing)}
    end)
  end

  defp await_restored(queues, deadline) do
    cond do
      queue_states(queues) == Map.new(queues) ->
        :ok

      System.monotonic_time(:millisecond) < deadline ->
        Process.sleep(50)
        await_restored(queues, deadline)

      true ->
        raise "Preview queues did not restore their original paused states"
    end
  end

  defp retire_fixture_jobs do
    case Repo.get_by(Community, slug: @slug) do
      nil ->
        :ok

      community ->
        article_ids =
          Repo.all(
            from(b in ArticleBinding,
              where: b.community_id == ^community.id,
              select: type(b.article_id, :string)
            )
          )

        community_id = to_string(community.id)

        events =
          Repo.all(
            from(e in CMS.Outbox.Event,
              where:
                (e.resource_type == "article" and e.resource_id in ^article_ids) or
                  (e.resource_type == "community" and e.resource_id == ^community_id)
            )
          )

        ids = Enum.map(events, & &1.id)

        {:ok, _cancelled_count} =
          Oban.cancel_all_jobs(
            from(j in Oban.Job,
              where: fragment("?->>'event_id'", j.args) in ^ids
            )
          )

        for event <- events, event.status in [:waiting, :retrying] do
          CMS.Outbox.execute(event.id, fn _ -> {:error, :preview_fixture_retired} end,
            on_error: :fail
          )

          unless Repo.get!(CMS.Outbox.Event, event.id).status == :failed,
            do: raise("Could not retire fixture intent #{event.id}")
        end

        if Enum.any?(events, &(&1.status == :running)),
          do: raise("Fixture has an in-flight intent; keep queues paused for inspection")

        :ok
    end
  end

  defp acknowledge_transition({:error, _} = error), do: error

  defp acknowledge_transition({:ok, result}) do
    # Dispatch the real event and settle all three children before restoring the sink.
    events =
      Repo.all(
        from(event in CMS.Outbox.Event,
          where:
            event.event == "article.visibility_changed" and
              like(event.effect_key, ^("%" <> result.operation_ref <> "%"))
        )
      )

    if result.transitions > 0 and events == [], do: raise("Missing fixture visibility event")

    deliveries =
      Enum.map(events, fn event ->
        deadline = System.monotonic_time(:millisecond) + 20_000
        deliver(event.id, deadline)
      end)

    {:ok, Map.put(result, :deliveries, deliveries)}
  end

  defp deliver(id, deadline) do
    _result =
      CMS.Outbox.Workflow.Article.perform(%Oban.Job{
        args: %{"event_id" => id},
        attempt: 1,
        max_attempts: 20
      })

    children =
      Repo.all(
        from(e in CMS.Outbox.Event,
          where: e.command_id == ^id and e.identity_type == :workflow
        )
      )

    for child <- children do
      {worker, attempt} =
        case child.event do
          "press.cache_invalidation" -> {GroupherServer.Jobs.CMSOutboxPress, 1}
          "article.search_sync" -> {GroupherServer.Jobs.CMSOutboxSearch, 1}
          "article.cdn_purge" -> {GroupherServer.Jobs.CMSOutboxCDN, 8}
        end

      worker.perform(%Oban.Job{
        args: %{"event_id" => child.id},
        attempt: attempt,
        max_attempts: 8
      })
    end

    states =
      Map.new(children, fn child ->
        current = Repo.get!(CMS.Outbox.Event, child.id)
        {current.event, %{status: current.status, error: current.last_error_code}}
      end)

    press = states["press.cache_invalidation"]
    search = states["article.search_sync"]
    cdn = states["article.cdn_purge"]

    expected_cdn =
      cdn &&
        (cdn.status == :done or
           (cdn.status == :failed and
              cdn.error in ["cloudflare_rejected", "cloudflare_not_configured"]))

    cond do
      map_size(states) == 3 and press.status == :done and search.status == :done and expected_cdn ->
        %{id: id, press_invalidated: true, children: states}

      System.monotonic_time(:millisecond) < deadline ->
        Process.sleep(250)
        deliver(id, deadline)

      true ->
        raise "Preview child delivery did not settle: #{inspect(states)}"
    end
  end

  defp locked_lifecycle(thread) do
    %{articles: articles} = snapshot()
    article = Enum.find(articles, &(&1.thread == thread))

    if thread == :doc do
      public = Repo.get_by!(DocPublic, article_id: article.id)

      Repo.one!(
        from(lifecycle in DocLifecycle,
          where: lifecycle.article_id == ^article.id and lifecycle.branch_id == ^public.branch_id,
          lock: "FOR UPDATE"
        )
      )
    else
      Repo.one!(
        from(lifecycle in ArticleLifecycle,
          where: lifecycle.article_id == ^article.id,
          lock: "FOR UPDATE"
        )
      )
    end
  end
end
