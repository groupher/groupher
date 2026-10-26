defmodule GroupherServer.Test.CMS.Press.InvalidationTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Outbox.Event
  alias CMS.Press.Invalidation

  defmodule Endpoint do
    @moduledoc false

    import Plug.Conn

    def init(opts), do: opts

    def call(conn, _opts) do
      status = Application.fetch_env!(:groupher_server, :press_invalidation_test_status)

      if pid = Application.get_env(:groupher_server, :press_invalidation_test_pid) do
        send(pid, {:press_invalidation_received, conn.request_path})
      end

      conn
      |> put_resp_content_type("application/json")
      |> send_resp(status, ~s({"ok":true}))
    end
  end

  defmodule UnavailableSearch do
    @moduledoc false
    @behaviour CMS.SearchArtiments.PlatformAdapter
    def upsert(_articles, _opts), do: {:error, :search_unavailable}
    def delete(_refs), do: {:error, :search_unavailable}
    def update_metrics(_updates), do: {:error, :search_unavailable}
    def search(_query), do: {:error, :search_unavailable}
  end

  setup do
    search = Application.fetch_env!(:groupher_server, :search_artiments)
    endpoint_pid = Application.get_env(:groupher_server, :press_invalidation_test_pid)
    endpoint = System.get_env("PRESS_INTERNAL_URL")
    resource = System.get_env("PRESS_INTERNAL_RESOURCE")
    service_auth = Application.get_env(:groupher_server, GroupherServer.ServiceAuth.Client)
    response_status = Application.get_env(:groupher_server, :press_invalidation_test_status)

    on_exit(fn ->
      Application.put_env(:groupher_server, :search_artiments, search)

      if endpoint_pid do
        Application.put_env(:groupher_server, :press_invalidation_test_pid, endpoint_pid)
      else
        Application.delete_env(:groupher_server, :press_invalidation_test_pid)
      end

      restore_env("PRESS_INTERNAL_URL", endpoint)
      restore_env("PRESS_INTERNAL_RESOURCE", resource)

      if is_nil(service_auth) do
        Application.delete_env(:groupher_server, GroupherServer.ServiceAuth.Client)
      else
        Application.put_env(:groupher_server, GroupherServer.ServiceAuth.Client, service_auth)
      end

      if is_nil(response_status) do
        Application.delete_env(:groupher_server, :press_invalidation_test_status)
      else
        Application.put_env(:groupher_server, :press_invalidation_test_status, response_status)
      end
    end)

    :ok
  end

  test "an absent endpoint is an explicit local no-op" do
    System.delete_env("PRESS_INTERNAL_URL")

    assert {:ok, :pass} = Invalidation.invalidate("elixir")
  end

  test "an authentication failure is returned so the Outbox can retry" do
    System.put_env("PRESS_INTERNAL_URL", "https://press.invalid")
    System.put_env("PRESS_INTERNAL_RESOURCE", "https://press.invalid/#{System.unique_integer()}")
    Application.put_env(:groupher_server, GroupherServer.ServiceAuth.Client, [])

    assert {:error, :press_invalidation_auth_failed} = Invalidation.invalidate("elixir")
  end

  test "a successful authenticated request completes the delivery" do
    endpoint = start_endpoint(200)
    cache_token(endpoint)

    assert {:ok, :pass} = Invalidation.invalidate("elixir")
  end

  test "a non-success response is returned so the Outbox can retry" do
    endpoint = start_endpoint(503)
    cache_token(endpoint)

    assert {:error, {:press_invalidation_http_status, 503}} =
             Invalidation.invalidate("elixir")
  end

  test "a network failure is returned so the Outbox can retry" do
    endpoint = "http://127.0.0.1:1"
    cache_token(endpoint)

    assert {:error, :press_invalidation_request_failed} = Invalidation.invalidate("elixir")
  end

  test "the Press workflow leaves an authentication failure retryable" do
    {community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_threads: [:post]},
               user,
               command_id
             )

    event = Repo.get_by!(Event, command_id: command_id, event: "press.cache_invalidation")

    System.put_env("PRESS_INTERNAL_URL", "https://press.invalid")
    System.put_env("PRESS_INTERNAL_RESOURCE", "https://press.invalid/#{System.unique_integer()}")
    Application.put_env(:groupher_server, GroupherServer.ServiceAuth.Client, [])

    assert {:error, :press_invalidation_auth_failed} =
             GroupherServer.Jobs.CMSOutboxPress.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 3
             })

    assert Repo.get!(Event, event.id).status == :retrying
  end

  test "Article visibility outbox retries when Press cache invalidation fails" do
    {community, article_view, _attrs, _user} = mock_article(:post)

    {:ok, event} =
      CMS.Outbox.send(%{
        event: "article.visibility_changed",
        worker: GroupherServer.Jobs.CMSOutboxArticle,
        resource_type: "article",
        resource_id: article_view.id,
        command_id: Ecto.UUID.generate(),
        data: %{
          "community" => community.slug,
          "community_id" => community.id,
          "thread" => "post",
          "inner_id" => article_inner_id(article_view, community)
        }
      })

    System.put_env("PRESS_INTERNAL_URL", "https://press.invalid")
    System.put_env("PRESS_INTERNAL_RESOURCE", "https://press.invalid/#{System.unique_integer()}")
    Application.put_env(:groupher_server, GroupherServer.ServiceAuth.Client, [])

    assert {:error, :press_invalidation_auth_failed} =
             GroupherServer.CMS.Outbox.Workflow.Article.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 3
             })

    assert Repo.get!(Event, event.id).status == :retrying
  end

  test "Search failure cannot prevent visibility cache invalidation" do
    {community, article, _attrs, _user} = mock_article(:post)

    {:ok, event} =
      CMS.Outbox.send(%{
        event: "article.visibility_changed",
        worker: GroupherServer.Jobs.CMSOutboxArticle,
        resource_type: "article",
        resource_id: article.id,
        command_id: Ecto.UUID.generate(),
        data: %{
          "community" => community.slug,
          "community_id" => community.id,
          "thread" => "post",
          "inner_id" => article_inner_id(article, community)
        }
      })

    endpoint = start_endpoint(200)
    cache_token(endpoint)
    Application.put_env(:groupher_server, :press_invalidation_test_pid, self())
    config = Application.fetch_env!(:groupher_server, :search_artiments)

    Application.put_env(
      :groupher_server,
      :search_artiments,
      Keyword.put(config, :platform, UnavailableSearch)
    )

    assert {:error, :search_unavailable} =
             CMS.Outbox.Workflow.Article.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 3
             })

    assert_receive {:press_invalidation_received, "/internal/invalidate"}, 1_000
    assert Repo.get!(Event, event.id).status == :retrying
  end

  test "a completed Command replay restores a missing durable invalidation intent" do
    {community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_threads: [:post]},
               user,
               command_id
             )

    event = Repo.get_by!(Event, command_id: command_id, event: "press.cache_invalidation")

    Repo.delete_all(
      from(job in Oban.Job, where: fragment("?->>'event_id' = ?", job.args, ^event.id))
    )

    Repo.delete!(event)

    assert {:ok, _replayed} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_threads: [:post]},
               user,
               command_id
             )

    assert %Event{} =
             Repo.get_by(Event, command_id: command_id, event: "press.cache_invalidation")
  end

  defp start_endpoint(status) do
    ref = Module.concat(__MODULE__, "Endpoint#{System.unique_integer([:positive])}")
    Application.put_env(:groupher_server, :press_invalidation_test_status, status)
    {:ok, _pid} = Plug.Cowboy.http(Endpoint, [], port: 0, ref: ref)
    on_exit(fn -> Plug.Cowboy.shutdown(ref) end)

    "http://127.0.0.1:#{:ranch.get_port(ref)}"
  end

  defp cache_token(endpoint) do
    resource = "#{endpoint}/internal"
    System.put_env("PRESS_INTERNAL_URL", endpoint)
    System.put_env("PRESS_INTERNAL_RESOURCE", resource)

    :ets.insert(
      :groupher_service_token_cache,
      {{resource, ["press:cache:invalidate"]}, "test-service-token",
       System.system_time(:second) + 3_600}
    )
  end

  defp restore_env(name, nil), do: System.delete_env(name)
  defp restore_env(name, value), do: System.put_env(name, value)
end
