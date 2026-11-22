defmodule GroupherServer.CMS.ProductionSeed.PrivilegesConcurrencyTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  import GroupherServer.Support.Factory
  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.GlobalPassport
  alias CMS.ProductionSeed.Privileges

  test "temporary root stays invisible and a concurrent grant is not lost" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, user} = db_insert(:user)

      {:ok, original} =
        %GlobalPassport{} |> GlobalPassport.changeset(%{user_id: user.id}) |> Repo.insert()

      parent = self()

      try do
        first =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                Privileges.with_temporary_root!(user.id, fn ->
                  send(parent, {:elevated, self()})

                  receive do
                    :continue -> :done
                  after
                    10_000 -> Repo.rollback(:timeout)
                  end
                end)
              end)
            end)
          end)

        assert_receive {:elevated, pid}, 10_000
        assert {:ok, %{is_root: false}} = CMS.Passport.global_facts(user.id)

        second =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, :writer_started)

              Repo.transaction(fn ->
                CMS.Passport.Store.grant_global_in_transaction(user.id, original, %{
                  "community.create" => true
                })
              end)
            end)
          end)

        assert_receive :writer_started, 10_000
        assert Task.yield(second, 100) == nil
        send(pid, :continue)
        assert {:ok, :done} = Task.await(first, 10_000)
        assert {:ok, {:ok, updated}} = Task.await(second, 10_000)
        refute updated.is_root
        assert updated.permissions == %{"community.create" => true}
      after
        Repo.delete_all(from(p in GlobalPassport, where: p.user_id == ^user.id))
      end
    end)
  end

  test "SQL failure preserves its error and rolls back temporary root" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, user} = db_insert(:user)

      assert {:error, {:seed_temporary_root_failed, %Postgrex.Error{}}} =
               Repo.transaction(fn ->
                 Privileges.with_temporary_root!(user.id, fn ->
                   Ecto.Adapters.SQL.query!(Repo, "SELECT 1 / 0", [])
                 end)
               end)

      refute Repo.get_by(GlobalPassport, user_id: user.id)
    end)
  end

  @tag skip: System.get_env("TEST_REF_ISOLATED") != "1"
  @tag timeout: 60_000
  test "seed resource locks and a real Article publish serialize in the same order" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, actor} = db_insert(:user)
      {:ok, community} = mock_community(actor)
      {:ok, seed_community} = mock_community(actor)
      body = mock_body_bag(Jason.encode!([%{"type" => "p", "children" => [%{"text" => "seed"}]}]))

      {:ok, %{article: article, working_copy: work}} =
        CMS.Articles.create_article(
          community,
          :post,
          %{title: "seed lock", body_bag: body},
          actor,
          command_id: Ecto.UUID.generate()
        )

      manifest = %{
        "communities" => %{"site" => seed_community.id},
        "resources" => %{}
      }

      ast = [
        %{
          "type" => "mention",
          "key" => "post:#{article.id}",
          "children" => [%{"text" => "target"}]
        }
      ]

      bodies = [{%{"json" => Jason.encode!(ast)}, seed_community.id}]

      parent = self()

      holder =
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            Repo.transaction(fn ->
              Privileges.lock_resources!(manifest, bodies)

              Privileges.with_temporary_root!(actor.id, fn ->
                send(parent, {:seed_locked, self()})

                receive do
                  :continue -> :done
                after
                  10_000 -> Repo.rollback(:timeout)
                end
              end)
            end)
          end)
        end)

      assert_receive {:seed_locked, pid}, 10_000

      publisher =
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            send(parent, :publish_started)

            CMS.Articles.publish_article(
              article,
              community,
              %{working_copy_id: work.id, revision: work.revision},
              nil,
              actor,
              Ecto.UUID.generate()
            )
          end)
        end)

      assert_receive :publish_started, 10_000
      assert Task.yield(publisher, 100) == nil
      send(pid, :continue)
      assert {:ok, :done} = Task.await(holder, 10_000)
      assert {:ok, %{public: _}} = Task.await(publisher, 10_000)
      refute Repo.get_by(GlobalPassport, user_id: actor.id)
    end)
  end

  @tag skip: System.get_env("TEST_REF_ISOLATED") != "1"
  @tag timeout: 60_000
  test "comment, ticket and public locator targets join the seed lock set" do
    Sandbox.unboxed_run(Repo, fn ->
      {community, post, _, actor} = mock_article(:post)
      {locator_community, locator, _, _} = mock_article(:post)
      {:ok, seed_community} = mock_community(actor)

      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :post,
          post.inner_id,
          mock_comment("seed target"),
          actor,
          Ecto.UUID.generate()
        )

      grants =
        ~w(ticket.create ticket.link_source ticket.update ticket.transition ticket.assign ticket.manage_case ticket.manage_visibility ticket.read_internal)
        |> Map.new(&{&1, true})

      ticket_actor = %{
        actor
        | cur_passport: %{"global" => %{}, community.slug => %{"cms" => grants}}
      }

      {:ok, ticket} =
        CMS.Tickets.create_from_post(
          community,
          post.id,
          %{title: "Seed lock target", digest: "Ticket summary"},
          ticket_actor,
          Ecto.UUID.generate()
        )

      {:ok, internal} = CMS.Tickets.get_internal(community, ticket.id, ticket_actor)

      {:ok, _} =
        CMS.Tickets.publish(
          community,
          ticket.id,
          "published",
          internal.working_copy_revision,
          internal.lifecycle_version,
          internal.workflow_version,
          ticket_actor,
          Ecto.UUID.generate(),
          CMS.Tickets.Publication.preview_anchor(community.id, ticket.id)
        )

      {:ok, ticket} = CMS.Tickets.get_internal(community, ticket.id, ticket_actor)

      ast = [
        %{
          "type" => "mention",
          "key" => "comment:#{comment.id}",
          "children" => [%{"text" => "comment"}]
        },
        %{
          "type" => "a",
          "url" => "https://groupher.com/#{locator_community.slug}/post/#{locator.inner_id}",
          "children" => [%{"text" => "post"}]
        },
        %{
          "type" => "a",
          "url" => "https://groupher.com/#{community.slug}/ticket/#{ticket.inner_id}",
          "children" => [%{"text" => "ticket"}]
        }
      ]

      manifest = %{"communities" => %{"site" => seed_community.id}, "resources" => %{}}
      parent = self()

      holder =
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            Repo.transaction(fn ->
              Privileges.lock_resources!(manifest, [
                {%{"json" => Jason.encode!(ast)}, seed_community.id}
              ])

              send(parent, {:targets_locked, self()})

              receive do
                :continue -> :done
              after
                10_000 -> Repo.rollback(:timeout)
              end
            end)
          end)
        end)

      assert_receive {:targets_locked, pid}, 10_000

      for {id, site, thread} <- [
            {post.id, community, :post},
            {locator.id, locator_community, :post},
            {ticket.id, community, :ticket}
          ] do
        key = CMS.Articles.MutationLock.key(site, thread, id)
        <<hash::signed-64, _::binary>> = :crypto.hash(:sha256, key)

        assert {:ok, false} =
                 Repo.transaction(fn ->
                   {:ok, result} = Repo.query("SELECT pg_try_advisory_xact_lock($1)", [hash])
                   result.rows == [[true]]
                 end)
      end

      send(pid, :continue)
      assert {:ok, :done} = Task.await(holder, 10_000)
    end)
  end

  @tag skip: System.get_env("TEST_REF_ISOLATED") != "1"
  @tag timeout: 60_000
  test "opposite user mentions lock actors and recipients in a shared order" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, first_user} = db_insert(:user)
      {:ok, second_user} = db_insert(:user)
      {:ok, community} = mock_community(first_user)
      parent = self()

      body = fn recipient ->
        ast = [
          %{
            "type" => "mention",
            "key" => "user:#{recipient.login}",
            "userId" => 0,
            "value" => recipient.login,
            "children" => [%{"text" => recipient.login}]
          }
        ]

        [{%{"json" => Jason.encode!(ast)}, community.id}]
      end

      manifest = fn actor ->
        %{
          "communities" => %{"site" => community.id},
          "users" => %{"author" => actor.id},
          "resources" => %{}
        }
      end

      run = fn actor, recipient, label ->
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            Repo.transaction(fn ->
              Privileges.lock_resources!(manifest.(actor), body.(recipient))

              Privileges.with_temporary_root!(actor.id, fn ->
                send(parent, {label, self()})

                receive do
                  :continue -> :done
                after
                  10_000 -> Repo.rollback(:timeout)
                end
              end)
            end)
          end)
        end)
      end

      first = run.(first_user, second_user, :first_locked)
      assert_receive {:first_locked, first_pid}, 10_000
      second = run.(second_user, first_user, :second_locked)
      assert Task.yield(second, 100) == nil
      send(first_pid, :continue)
      assert {:ok, :done} = Task.await(first, 10_000)
      assert_receive {:second_locked, second_pid}, 10_000
      send(second_pid, :continue)
      assert {:ok, :done} = Task.await(second, 10_000)
      refute Repo.get_by(GlobalPassport, user_id: first_user.id)
      refute Repo.get_by(GlobalPassport, user_id: second_user.id)
    end)
  end
end
