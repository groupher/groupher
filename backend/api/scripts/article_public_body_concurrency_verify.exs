# Run only in a named disposable R3 database after migrations.
import ExUnit.Assertions
import Ecto.Query

alias GroupherServer.{CMS, Repo}
alias GroupherServer.Test.ArticleContentFixture
alias GroupherServer.Support.Factory
alias CMS.Articles.{Body, Public}
alias CMS.Articles.WorkingCopy.Snapshotter

alias CMS.Model.{
  Article,
  ArticlePublic,
  ArticlePublicBody,
  ArticleWorkingCopy,
  ArticleBodyDocument
}

expected = System.fetch_env!("ARTICLE_R3_DISPOSABLE_DATABASE")
[[database]] = Repo.query!("SELECT current_database()").rows

unless Mix.env() == :test and database == expected and
         String.starts_with?(database, "groupher_r03_") do
  raise "R3 concurrency exercise requires an explicitly named disposable database"
end

{community, view, _, actor} = ArticleContentFixture.article(:post)
article = Repo.get!(Article, view.id)
work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
public = Repo.get!(ArticlePublic, article.id)

snapshots =
  Enum.map_reduce(["candidate one", "candidate two"], work, fn text, current ->
    {:ok, saved} =
      CMS.Articles.save_working_copy(
        article,
        community,
        current.id,
        %{body_bag: Factory.mock_body_bag(Factory.mock_rich_text(text))},
        current.revision,
        actor,
        Ecto.UUID.generate()
      )

    {:ok, snapshot} =
      Repo.transact(fn ->
        Snapshotter.freeze_in_transaction(saved.id, saved.revision, actor, Ecto.UUID.generate())
      end)

    {snapshot, saved}
  end)
  |> elem(0)

parent = self()
# Hold the Article lock so both real connections contend for the same initial head.
{:ok, tasks} =
  Repo.transaction(fn ->
    Repo.one!(from(a in Article, where: a.id == ^article.id, lock: "FOR UPDATE"))

    tasks =
      Enum.map(snapshots, fn snapshot ->
        Task.async(fn ->
          send(parent, :ready)

          CMS.Articles.publish_article(
            article,
            community,
            %{snapshot_id: snapshot.id},
            public.snapshot_id,
            actor,
            Ecto.UUID.generate()
          )
        end)
      end)

    for _ <- tasks do
      receive do
        :ready -> :ok
      after
        5000 -> raise "publisher did not start"
      end
    end

    tasks
  end)

results = Enum.map(tasks, &Task.await(&1, 30_000))
assert Enum.count(results, &match?({:ok, _}, &1)) == 1
assert {:error, :public_conflict} in results
{:ok, {head, snapshot}} = Public.current(article.id)
assert head.snapshot_id in Enum.map(snapshots, & &1.id)
assert ArticleBodyDocument.document(head.body) == Body.document(snapshot)

assert {:error, :public_conflict} =
         Repo.transact(fn -> Public.rebuild(article, public.snapshot_id) end)

# The rollback is observed from another connection while a half-written transaction waits.
original = Repo.get!(ArticlePublicBody, article.id)
other = Enum.find(snapshots, &(&1.id != head.snapshot_id))

writer =
  Task.async(fn ->
    Repo.transaction(fn ->
      Repo.query!("UPDATE cms.article_publics SET snapshot_id=$1 WHERE article_id=$2", [
        Ecto.UUID.dump!(other.id),
        Ecto.UUID.dump!(article.id)
      ])

      send(parent, {:head_written, self()})

      receive do
        :rollback -> Repo.rollback(:deliberate)
      after
        5000 -> raise "rollback signal missing"
      end
    end)
  end)

receive do
  {:head_written, pid} ->
    {:ok, {visible, _}} = Public.current(article.id)
    assert visible.snapshot_id == head.snapshot_id
    assert Repo.get!(ArticlePublicBody, article.id) == original
    send(pid, :rollback)
after
  5000 -> raise "writer did not reach barrier"
end

assert {:error, :deliberate} = Task.await(writer)
assert Repo.get!(ArticlePublic, article.id).snapshot_id == head.snapshot_id
IO.puts("R3 concurrent publication, stale rebuild and atomic visibility passed")
