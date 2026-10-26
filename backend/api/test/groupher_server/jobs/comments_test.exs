defmodule GroupherServer.Test.Jobs.Comments do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Accounts, CMS, Jobs}
  alias CMS.Model.{Comment, Community}
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
    comment = %Comment{id: 11}
    actor = %User{id: 12}
    community = %Community{id: 13}
    article_id = Ecto.UUID.generate()

    calls = [
      {:sync_mentions, fn -> Jobs.sync_mentions(comment) end},
      {:subscribe_community, fn -> Jobs.subscribe_community(community, actor) end},
      {:reconcile_comments_participants,
       fn -> Jobs.reconcile_comments_participants(:post, article_id, 7) end}
    ]

    for {type, enqueue} <- calls do
      assert {:ok, %Oban.Job{worker: "GroupherServer.Jobs.Comments"} = job} = enqueue.()
      args = Map.new(job.args, fn {key, value} -> {to_string(key), value} end)
      assert args["type"] == Atom.to_string(type)
      assert is_map(args["payload"])
    end
  end

  test "a deleted Comment makes a queued effect an idempotent success" do
    assert {:ok, :pass} =
             Jobs.Comments.perform(%Oban.Job{
               args: %{
                 "type" => "sync_mentions",
                 "version" => 1,
                 "payload" => %{"comment_id" => 2_147_483_647}
               }
             })
  end
end
