defmodule GroupherServer.Test.CMS.Articles.Versioning.MutationLock do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Articles.MutationLock

  test "Doc lock keys are scoped by branch" do
    {community, _existing_post, _attrs, _user} = mock_article(:post)
    article_hash_id = Ecto.UUID.generate()

    refute MutationLock.doc_key(community, 11, article_hash_id) ==
             MutationLock.doc_key(community, 12, article_hash_id)

    assert MutationLock.key(community, :post, article_hash_id) !=
             MutationLock.doc_key(community, 11, article_hash_id)
  end

  test "observed hold telemetry closes after the surrounding command transaction" do
    {community, post, _attrs, _user} = mock_article(:post)
    handler_id = {__MODULE__, make_ref()}
    event = [:groupher, :cms, :articles, :mutation_lock, :hold]
    test_pid = self()

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, measurements, metadata, _config ->
          send(test_pid, {:hold, measurements, metadata})
        end,
        nil
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    assert {:ok, :done} =
             MutationLock.observe_transaction(fn ->
               result = MutationLock.with_article(community, post, fn -> :done end)
               refute_received {:hold, _, _}
               result
             end)

    assert_receive {:hold, %{duration: duration}, %{aggregate: :article}}
    assert is_integer(duration) and duration >= 0
  end
end
