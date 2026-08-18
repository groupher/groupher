defmodule GroupherServer.Test.Accounts.Mailbox do
  @moduledoc false

  use GroupherServer.TestMate, async: false
  # TODO import Service.Utils move both helper and github
  # import Helper.Utils

  alias GroupherServer.{Accounts, FrontDesk, Messaging}
  alias GroupherServer.FrontDesk.Cache, as: FrontDeskCache
  alias GroupherServer.Messaging.Model.{Mention, Notification}

  @default_mailbox_status Accounts.Model.Embeds.UserMailbox.default_status()

  setup do
    {:ok, post} = db_insert(:post)
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, ~m(post user user2 user3)a}
  end

  describe "mailbox status" do
    test "can get default mailbox status", ~m(user)a do
      {:ok, status} = Accounts.Mailbox.status(user)
      assert status == @default_mailbox_status
    end

    test "can get mailbox status", ~m(post user user2)a do
      notify_attrs = %{
        thread: :post,
        article_id: post.id,
        title: post.title,
        action: :upvote,
        user_id: user.id
      }

      {:ok, _} = Messaging.send_notification(notify_attrs, user2)
      {:ok, user} = Accounts.Mailbox.update_status(user.id)

      assert user.mailbox.is_empty == false
      assert user.mailbox.unread_notifications_count == 1
      assert user.mailbox.unread_total_count == 1

      mention_contents = [
        %{
          thread: :post,
          title: post.title,
          article_id: post.id,
          comment_id: nil,
          read: false,
          block_linker: ["tmp"],
          from_user_id: user2.id,
          to_user_id: user.id,
          inserted_at: post.updated_at |> DateTime.truncate(:second),
          updated_at: post.updated_at |> DateTime.truncate(:second)
        }
      ]

      {:ok, :pass} = Messaging.send_mention(post, mention_contents, user2)
      {:ok, user} = Accounts.Mailbox.update_status(user.id)

      assert user.mailbox.is_empty == false
      assert user.mailbox.unread_notifications_count == 1
      assert user.mailbox.unread_mentions_count == 1
      assert user.mailbox.unread_total_count == 2
    end

    test "updates multiple users with four business queries and fills missing counts with zero",
         ~m(post user user2 user3)a do
      insert_mention(post, user2, user)
      insert_mention(post, user2, user2, read: true)
      insert_notification(post, user)
      insert_notification(post, user2)

      {single_result, single_queries} =
        capture_repo_queries(fn -> Accounts.Mailbox.update_status_many([user3.id]) end)

      {many_result, many_queries} =
        capture_repo_queries(fn ->
          Accounts.Mailbox.update_status_many([
            user3.id,
            user.id,
            nil,
            user2.id,
            user.id
          ])
        end)

      assert {:ok, :pass} = single_result
      assert {:ok, :pass} = many_result
      assert business_query_count(single_queries) == 4
      assert business_query_count(many_queries) == 4

      user = Repo.get!(User, user.id)
      user2 = Repo.get!(User, user2.id)
      user3 = Repo.get!(User, user3.id)

      assert user.mailbox.unread_mentions_count == 1
      assert user.mailbox.unread_notifications_count == 1
      assert user.mailbox.unread_total_count == 2
      assert user.mailbox.is_empty == false

      assert user2.mailbox.unread_mentions_count == 0
      assert user2.mailbox.unread_notifications_count == 1
      assert user2.mailbox.unread_total_count == 1
      assert user2.mailbox.is_empty == false

      assert user3.mailbox.unread_mentions_count == 0
      assert user3.mailbox.unread_notifications_count == 0
      assert user3.mailbox.unread_total_count == 0
      assert user3.mailbox.is_empty == true
    end

    test "validates all users before writing any mailbox", ~m(user user2)a do
      {:ok, user} = ORM.update_embed(user, :mailbox, mailbox_status(7))

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :not_exist}} =
               Accounts.Mailbox.update_status_many([user.id, -1, user2.id])

      persisted_user = Repo.get!(User, user.id)
      assert persisted_user.mailbox.unread_total_count == 7
    end

    test "keeps database and cache unchanged when the outer transaction rolls back", ~m(user)a do
      {:ok, user} = ORM.update_embed(user, :mailbox, mailbox_status(7))
      stale_cached_user = %{user | mailbox: mailbox_struct(user.mailbox, 99)}
      {:ok, true} = FrontDeskCache.put_user(stale_cached_user)

      rollback_error = GroupherServer.ErrorCat.custom("forced rollback")

      result =
        Ecto.Multi.new()
        |> Ecto.Multi.run(:update_mailbox, fn _, _ ->
          Accounts.Mailbox.update_status_many_in_transaction([user.id])
        end)
        |> Ecto.Multi.run(:force_rollback, fn _, _ -> {:error, rollback_error} end)
        |> Repo.transaction()

      assert {:error, :force_rollback, ^rollback_error, _changes} = result

      persisted_user = Repo.get!(User, user.id)
      assert persisted_user.mailbox.unread_total_count == 7

      {:ok, cached_user} = FrontDesk.user(user.login)
      assert cached_user.mailbox.unread_total_count == 99
    end

    test "invalidates the user cache only after a successful update", ~m(post user user2)a do
      insert_mention(post, user2, user)

      stale_cached_user = %{user | mailbox: mailbox_struct(user.mailbox, 99)}
      {:ok, true} = FrontDeskCache.put_user(stale_cached_user)

      assert {:ok, :pass} = Accounts.Mailbox.update_status_many([user.id])

      {:ok, refreshed_user} = FrontDesk.user(user.login)
      assert refreshed_user.mailbox.unread_mentions_count == 1
      assert refreshed_user.mailbox.unread_total_count == 1
    end
  end

  defp insert_mention(post, from_user, to_user, opts \\ []) do
    read = Keyword.get(opts, :read, false)
    now = Datetime.now(:second)

    {1, nil} =
      Repo.insert_all(Mention, [
        %{
          thread: :post,
          title: post.title,
          article_id: post.id,
          comment_id: nil,
          read: read,
          block_linker: ["mailbox-test"],
          from_user_id: from_user.id,
          to_user_id: to_user.id,
          inserted_at: now,
          updated_at: now
        }
      ])
  end

  defp insert_notification(post, user) do
    now = Datetime.now(:second)

    {1, nil} =
      Repo.insert_all(Notification, [
        %{
          thread: :post,
          title: post.title,
          article_id: post.id,
          comment_id: nil,
          action: "UPVOTE",
          read: false,
          from_users: [],
          from_users_count: 0,
          user_id: user.id,
          inserted_at: now,
          updated_at: now
        }
      ])
  end

  defp mailbox_status(count) do
    %{
      unread_mentions_count: count,
      unread_notifications_count: 0,
      unread_total_count: count,
      is_empty: count < 1
    }
  end

  defp mailbox_struct(nil, count) do
    struct(
      Accounts.Model.Embeds.UserMailbox,
      Map.put(mailbox_status(count), :id, Ecto.UUID.generate())
    )
  end

  defp mailbox_struct(mailbox, count) do
    struct(mailbox, mailbox_status(count))
  end

  defp capture_repo_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref} ->
          send(pid, {query_ref, metadata.query})
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end

  defp business_query_count(queries) do
    Enum.count(queries, fn query ->
      query
      |> String.trim_leading()
      |> String.match?(~r/^(SELECT|UPDATE)/)
    end)
  end
end
