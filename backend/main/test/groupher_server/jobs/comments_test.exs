defmodule GroupherServer.Test.Jobs.Comments do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.Jobs
  alias GroupherServer.Jobs.Codec
  alias GroupherServer.CMS.Model.{Comment, Community, Post}
  alias GroupherServer.Accounts.Model.User

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
    article = %Post{id: 14}

    calls = [
      {:sync_mentions, fn -> Jobs.sync_mentions(comment) end},
      {:audition, fn -> Jobs.audition(comment) end},
      {:notify_comment, fn -> Jobs.notify_comment(comment, actor) end},
      {:notify_reply, fn -> Jobs.notify_reply(comment, actor) end},
      {:subscribe_community, fn -> Jobs.subscribe_community(community, actor) end},
      {:reconcile_comments_participants,
       fn -> Jobs.reconcile_comments_participants(article, 7) end}
    ]

    for {kind, enqueue} <- calls do
      assert {:ok, %Oban.Job{worker: "GroupherServer.Jobs.Comments"} = job} = enqueue.()
      args = Map.new(job.args, fn {key, value} -> {to_string(key), value} end)
      assert args["kind"] == Atom.to_string(kind)
      assert is_map(Codec.decode(args["payload"]))
    end
  end
end
