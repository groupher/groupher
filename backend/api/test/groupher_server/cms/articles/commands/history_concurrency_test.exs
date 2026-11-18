defmodule GroupherServer.Test.CMS.Articles.Commands.HistoryConcurrencyTest do
  use ExUnit.Case, async: false

  import Ecto.Query
  import GroupherServer.Support.Factory

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleEvent, ArticleWorkingCopy, CommandReceipt}

  @tag timeout: 60_000
  test "two independent same-revision saves produce one edit and one conflict" do
    Sandbox.unboxed_run(Repo, fn ->
      {community, public, _, actor} = mock_article(:post)
      article = Repo.get!(Article, public.article_id)
      work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
      parent = self()

      try do
        commands = [Ecto.UUID.generate(), Ecto.UUID.generate()]

        tasks =
          Enum.with_index(commands, fn command_id, index ->
            Task.async(fn ->
              Sandbox.unboxed_run(Repo, fn ->
                send(parent, {:ready, self()})

                receive do
                  :go -> :ok
                after
                  10_000 -> raise "save barrier timed out"
                end

                CMS.Articles.save_working_copy(
                  article,
                  community,
                  work.id,
                  %{title: "Concurrent #{index}"},
                  work.revision,
                  actor,
                  command_id
                )
              end)
            end)
          end)

        assert_receive {:ready, first}, 10_000
        assert_receive {:ready, second}, 10_000
        send(first, :go)
        send(second, :go)
        results = Enum.map(tasks, &Task.await(&1, 20_000))
        assert Enum.count(results, &match?({:ok, _}, &1)) == 1
        assert Enum.count(results, &match?({:error, _}, &1)) == 1
        operation_refs =
          Repo.all(
            from(receipt in CommandReceipt,
              where: receipt.command_id in ^commands,
              select: receipt.operation_ref
            )
          )

        events = Repo.all(from(event in ArticleEvent, where: event.operation_ref in ^operation_refs))
        assert [%ArticleEvent{type: :edit} = event] = events
        assert event.before_revision == work.revision
        assert event.after_revision == work.revision + 1
        assert Repo.get!(ArticleWorkingCopy, work.id).revision == event.after_revision
      after
        assert {:ok, :ok} = CMS.Seeds.FullCommunity.delete(community.slug)
      end
    end)
  end
end
