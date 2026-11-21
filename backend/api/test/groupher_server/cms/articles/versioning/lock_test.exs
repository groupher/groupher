defmodule GroupherServer.Test.CMS.Articles.Versioning.MutationLock do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Articles.MutationLock

  test "ordinary Article lock identity is shared by all Community bindings" do
    article_id = Ecto.UUID.generate()
    first = %CMS.Model.Community{id: 1}
    second = %CMS.Model.Community{id: 2}

    assert MutationLock.key(first, :post, article_id) ==
             MutationLock.key(second, :post, article_id)

    refute MutationLock.key(first, :post, article_id) ==
             MutationLock.key(first, :post, Ecto.UUID.generate())
  end

  test "Doc lock keys use the stable Article and owner Community" do
    community = %CMS.Model.Community{id: 1}
    other = %CMS.Model.Community{id: 2}
    article_id = Ecto.UUID.generate()

    assert MutationLock.key(community, :doc, article_id) ==
             MutationLock.key(community, :doc, article_id)

    refute MutationLock.key(community, :doc, article_id) ==
             MutationLock.key(other, :doc, article_id)

    refute MutationLock.key(community, :doc, article_id) ==
             MutationLock.key(community, :doc, Ecto.UUID.generate())
  end

  test "observed hold telemetry closes after the surrounding command transaction" do
    {community, post, _attrs, _user} = mock_article(:post)
    article = Repo.get!(CMS.Model.Article, post.id)
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
               result = MutationLock.with_article(community, article, fn -> :done end)
               refute_received {:hold, _, _}
               result
             end)

    assert_receive {:hold, %{duration: duration}, %{aggregate: :article}}
    assert is_integer(duration) and duration >= 0
  end
end
