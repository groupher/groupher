defmodule GroupherServer.Test.ReviewBot.ConfigQueryCountTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.ReviewBot
  alias ReviewBot.Config
  alias ReviewBot.Model.ReviewBotConfig

  test "default config lookup is bounded and retains existing configs" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    owner = self()
    ref = make_ref()
    handler = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler,
        event,
        fn _, _, metadata, _ ->
          if String.contains?(metadata.query, "review_bot_configs") and
               String.starts_with?(metadata.query, "SELECT") do
            send(owner, {ref, metadata.query})
          end
        end,
        nil
      )

    try do
      assert {:ok, {:ok, configs}} =
               Repo.transaction(fn ->
                 Config.create_default_configs_for_community(community.id)
               end)

      assert Enum.map(configs, & &1.subject_type) == [:article, :comment]

      queries =
        Stream.repeatedly(fn ->
          receive do
            {^ref, query} -> query
          after
            10 -> nil
          end
        end)
        |> Enum.take_while(& &1)

      IO.puts("REVIEW_BOT_EXISTING_CONFIG_SELECTS=#{length(queries)}")
      assert length(queries) == 1
    after
      :telemetry.detach(handler)
    end
  end

  test "recreates only the missing default configuration in the same transaction" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    article = Repo.get_by!(ReviewBotConfig, community_id: community.id, subject_type: :article)
    comment = Repo.get_by!(ReviewBotConfig, community_id: community.id, subject_type: :comment)
    Repo.delete!(comment)

    assert {:ok, {:ok, [kept, created]}} =
             Repo.transaction(fn -> Config.create_default_configs_for_community(community.id) end)

    assert kept.id == article.id
    assert created.subject_type == :comment
    assert created.id != comment.id
  end
end
