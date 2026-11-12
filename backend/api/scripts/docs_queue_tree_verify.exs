# Exercise directory reconciliation only on an explicitly named disposable test database.
import Ecto.Query
import ExUnit.Assertions
import GroupherServer.Support.Factory

alias Ecto.Adapters.SQL.Sandbox
alias GroupherServer.{CMS, Repo}
alias CMS.DocTree.Publish.Queue
alias CMS.Model.{DocsQueueTreeChange, DocsQueueTreeContributor}

[[database]] = Repo.query!("SELECT current_database()").rows
expected = System.get_env("DOCS_B0_DISPOSABLE_DATABASE")

unless Mix.env() == :test and is_binary(expected) and expected == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "Queue tree exercise requires an explicitly named disposable test database"
end

{:ok, a} = db_insert(:user)
{:ok, b} = db_insert(:user)
{:ok, c} = db_insert(:user)
{:ok, community} = db_insert(:community)
{:ok, queue} = Repo.transact(fn -> Queue.lock_or_create(community) end)

node = fn id, type, parent, index, href ->
  %{
    node_id: id,
    type: type,
    parent_node_id: parent,
    index: index,
    title: id,
    href: href,
    doc_id: nil,
    marker: nil,
    badge: nil,
    hidden: false
  }
end

tab = node.("tab", :tab, nil, 0, nil)
group = node.("group", :group, "tab", 0, nil)
one = node.("one", :link, "group", 0, "/one")
two = node.("two", :link, "group", 1, "/two")
public = [tab, group, one, two]
renamed = [tab, group, %{one | title: "Changed"}, two]
reordered = [tab, group, %{one | title: "Changed", index: 1}, %{two | index: 0}]
later_title = [tab, group, %{one | title: "Another"}, two]

assert {:ok, %{queue: %{queue_revision: 1}, changed_node_ids: ["one"]}} =
         Repo.transact(fn -> Queue.reconcile_tree(community, queue, 0, public, renamed, a) end)

assert Repo.get_by!(DocsQueueTreeContributor,
         queue_id: queue.id,
         node_id: "one",
         field_name: "title"
       ).user_id == a.id

assert {:ok, %{queue: %{queue_revision: 2}, changed_node_ids: ["one", "two"]}} =
         Repo.transact(fn -> Queue.reconcile_tree(community, queue, 1, public, reordered, b) end)

assert Repo.get_by!(DocsQueueTreeContributor,
         queue_id: queue.id,
         node_id: "one",
         field_name: "index"
       ).user_id == b.id

assert Repo.get_by!(DocsQueueTreeContributor,
         queue_id: queue.id,
         node_id: "two",
         field_name: "index"
       ).user_id == b.id

assert {:ok, %{queue: %{queue_revision: 3}}} =
         Repo.transact(fn -> Queue.reconcile_tree(community, queue, 2, public, renamed, c) end)

refute Repo.get_by(DocsQueueTreeContributor,
         queue_id: queue.id,
         node_id: "one",
         field_name: "index"
       )

refute Repo.get_by(DocsQueueTreeChange, queue_id: queue.id, node_id: "two")

assert Repo.get_by!(DocsQueueTreeContributor,
         queue_id: queue.id,
         node_id: "one",
         field_name: "title"
       ).user_id == a.id

assert {:ok, %{queue: %{queue_revision: 4}}} =
         Repo.transact(fn ->
           Queue.reconcile_tree(community, queue, 3, public, later_title, c)
         end)

assert Repo.get_by!(DocsQueueTreeContributor,
         queue_id: queue.id,
         node_id: "one",
         field_name: "title"
       ).user_id == c.id

assert {:ok, %{queue: %{queue_revision: 4}, changed_node_ids: []}} =
         Repo.transact(fn ->
           Queue.reconcile_tree(community, queue, 4, public, later_title, b)
         end)

assert {:ok, %{queue: %{queue_revision: 5}}} =
         Repo.transact(fn -> Queue.reconcile_tree(community, queue, 4, public, public, c) end)

assert Repo.aggregate(from(row in DocsQueueTreeChange, where: row.queue_id == ^queue.id), :count) ==
         0

assert Repo.aggregate(
         from(row in DocsQueueTreeContributor, where: row.queue_id == ^queue.id),
         :count
       ) == 0

three = node.("three", :link, "group", 2, "/three")

assert {:ok, %{queue: %{queue_revision: 6}}} =
         Repo.transact(fn ->
           Queue.reconcile_tree(community, queue, 5, public, public ++ [three], a)
         end)

assert Repo.aggregate(
         from(row in DocsQueueTreeContributor,
           where: row.queue_id == ^queue.id and row.node_id == "three"
         ),
         :count
       ) == 9

assert {:ok, %{queue: %{queue_revision: 7}}} =
         Repo.transact(fn -> Queue.reconcile_tree(community, queue, 6, public, public, b) end)

assert Repo.aggregate(
         from(row in DocsQueueTreeContributor, where: row.queue_id == ^queue.id),
         :count
       ) == 0

assert {:error, {:queue_version_conflict, :queue_revision, 7}} =
         Repo.transact(fn -> Queue.reconcile_tree(community, queue, 6, public, renamed, a) end)

assert {:error, :invalid_tree_parent} =
         Repo.transact(fn -> Queue.reconcile_tree(community, queue, 7, public, [tab, one], a) end)

assert {:ok, %{queue_revision: 7}} = Queue.read(community)

parent = self()

first =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transaction(fn ->
        assert {:ok, _} = Queue.reconcile_tree(community, queue, 7, public, renamed, a)
        send(parent, {:tree_written, self()})

        receive do
          :commit -> :committed
        after
          10_000 -> Repo.rollback(:barrier_timeout)
        end
      end)
    end)
  end)

assert_receive {:tree_written, writer}, 10_000

second =
  Task.async(fn ->
    Sandbox.unboxed_run(Repo, fn ->
      Repo.transact(fn ->
        send(parent, :tree_attempting)
        Queue.reconcile_tree(community, queue, 7, public, later_title, b)
      end)
    end)
  end)

assert_receive :tree_attempting, 10_000
assert Task.yield(second, 100) == nil
send(writer, :commit)
assert {:ok, :committed} = Task.await(first, 10_000)
assert {:error, {:queue_version_conflict, :queue_revision, 8}} = Task.await(second, 10_000)

assert {:error, :overflow_rollback} =
         Repo.transaction(fn ->
           {1, nil} =
             Repo.update_all(from(q in CMS.Model.DocsPublishQueue, where: q.id == ^queue.id),
               set: [queue_revision: 9_223_372_036_854_775_807]
             )

           assert {:error, :queue_version_exhausted} =
                    Queue.reconcile_tree(
                      community,
                      queue,
                      9_223_372_036_854_775_807,
                      public,
                      later_title,
                      c
                    )

           Repo.rollback(:overflow_rollback)
         end)

assert {:ok, %{queue_revision: 8}} = Queue.read(community)

assert Repo.get_by!(DocsQueueTreeContributor,
         queue_id: queue.id,
         node_id: "one",
         field_name: "title"
       ).user_id == a.id

assert Repo.get_by!(DocsQueueTreeChange, queue_id: queue.id, node_id: "one").target["title"] ==
         "Changed"

IO.puts("Docs Queue directory reconciliation passed")
