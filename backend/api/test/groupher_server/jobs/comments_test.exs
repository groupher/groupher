defmodule GroupherServer.Test.Jobs.Comments do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Accounts, CMS, Jobs}
  alias CMS.Model.Community
  alias Accounts.Model.User

  setup do
    oban_config =
      :groupher_server
      |> Application.fetch_env!(Oban)
      |> Keyword.merge(testing: :manual, queues: false, plugins: false)

    start_supervised!({Oban, oban_config})

    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :test_jobs)
    on_exit(fn -> Application.put_env(:groupher_server, :env, previous) end)
    :ok
  end

  test "named Comments APIs persist typed jobs and return inserted job values" do
    actor = %User{id: 12}
    community = %Community{id: 13}

    calls = [
      {:subscribe_community, fn -> Jobs.subscribe_community(community, actor) end}
    ]

    for {type, enqueue} <- calls do
      assert {:ok, %Oban.Job{worker: "GroupherServer.Jobs.Comments"} = job} = enqueue.()
      args = Map.new(job.args, fn {key, value} -> {to_string(key), value} end)
      assert args["type"] == Atom.to_string(type)
      assert is_map(args["payload"])
    end
  end
end
