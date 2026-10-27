# Compile only the fixture modules; the executable's production guard is not run in tests.
fixture_path = Path.expand("../../../../../../ops/press/preview-fixtures.exs", __DIR__)
{:__block__, _, forms} = fixture_path |> File.read!() |> Code.string_to_quoted!()
for {:defmodule, _, _} = form <- forms, do: Code.compile_quoted(form)

defmodule GroupherServer.Test.CMS.Press.PreviewFixtureTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Outbox.Event
  alias GroupherServer.PressPreview.Fixtures

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, plugins: false, queues: false})
    endpoint = System.get_env("PRESS_INTERNAL_URL")
    System.delete_env("PRESS_INTERNAL_URL")

    on_exit(fn ->
      if endpoint,
        do: System.put_env("PRESS_INTERNAL_URL", endpoint),
        else: System.delete_env("PRESS_INTERNAL_URL")
    end)

    :ok
  end

  test "hold and restore settle all children under the sink and restore adapter config" do
    previous = Application.fetch_env!(:groupher_server, :search_artiments)
    assert {:ok, _} = Fixtures.seed()

    for action <- [&Fixtures.hold/1, &Fixtures.restore/1] do
      assert {:ok, %{deliveries: [delivery]}} = action.(:post)
      assert delivery.press_invalidated
      assert delivery.children["press.cache_invalidation"].status == :done
      assert delivery.children["article.search_sync"].status == :done
      assert delivery.children["article.cdn_purge"].status in [:done, :failed]

      assert Repo.aggregate(
               from(e in Event,
                 where:
                   e.command_id == ^delivery.id and e.status in [:waiting, :running, :retrying]
               ),
               :count
             ) == 0

      assert previous == Application.fetch_env!(:groupher_server, :search_artiments)
    end
  end

  test "exception cleanup retires fixture leftovers before restoring the adapter" do
    previous = Application.fetch_env!(:groupher_server, :search_artiments)
    assert {:ok, %{community_id: community_id}} = Fixtures.seed()

    {:ok, event} =
      CMS.Outbox.send(%{
        event: "press.cache_invalidation",
        worker: GroupherServer.Jobs.CMSOutboxPress,
        resource_type: "community",
        resource_id: community_id,
        identity: {:workflow, Ecto.UUID.generate()},
        data: %{}
      })

    {:ok, job} = GroupherServer.Jobs.CMSOutboxPress.new(%{event_id: event.id}) |> Oban.insert()
    assert_raise BadMapError, fn -> Fixtures.hold(:not_a_thread) end
    assert Repo.get!(Oban.Job, job.id).state == "cancelled"
    assert Repo.get!(Event, event.id).status == :failed
    assert Repo.get!(Event, event.id).last_error_code == "preview_fixture_retired"
    assert previous == Application.fetch_env!(:groupher_server, :search_artiments)
  end
end
