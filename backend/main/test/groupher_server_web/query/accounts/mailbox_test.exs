defmodule GroupherServer.Test.Query.Accounts.Mailbox do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    user_conn = simu_conn(:user, user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn user user2)a}
  end

  describe "[accounts mailbox status]" do
    @query """
    query($login: String!) {
      user(login: $login) {
        id
        mailbox {
          isEmpty
          unreadTotalCount
          unreadMentionsCount
          unreadNotificationsCount
        }
      }
    }
    """
    test "auth user can get it's own default mailbox status", ~m(user_conn user)a do
      results = user_conn |> gq_query(@query, %{login: user.login})
      mailbox = results["mailbox"]

      assert mailbox["isEmpty"] == true
      assert mailbox["unreadTotalCount"] == 0
      assert mailbox["unreadMentionsCount"] == 0
      assert mailbox["unreadNotificationsCount"] == 0
    end

    test "auth user can get latest mailbox status after being mentioned",
         ~m(user_conn user user2)a do
      {:ok, _} = mock_mention_for(user, user2)

      results = user_conn |> gq_query(@query, %{login: user.login})
      mailbox = results["mailbox"]

      assert mailbox["isEmpty"] == false
      assert mailbox["unreadTotalCount"] == 1
      assert mailbox["unreadMentionsCount"] == 1
      assert mailbox["unreadNotificationsCount"] == 0
    end

    test "auth user can get latest mailbox status after being notified",
         ~m(user_conn user user2)a do
      mock_notification_for(user, user2)

      results = user_conn |> gq_query(@query, %{login: user.login})
      mailbox = results["mailbox"]

      assert mailbox["isEmpty"] == false
      assert mailbox["unreadTotalCount"] == 1
      assert mailbox["unreadMentionsCount"] == 0
      assert mailbox["unreadNotificationsCount"] == 1
    end
  end

  describe "[paged messages]" do
    @query """
    query($filter: MailboxMentionsFilter!) {
      pagedMentions(filter: $filter) {
        entries {
          id
          thread
          articleId
          title
          commentId
          read
          blockLinker
          user {
            login
            nickname
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "can get paged mentions", ~m(user_conn user user2)a do
      mock_mention_for(user, user2)

      variables = %{filter: %{page: 1, size: 20}}
      results = user_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      mention = results["entries"] |> List.first()
      assert user2.login == mention |> get_in(["user", "login"])

      variables = %{filter: %{page: 1, size: 20, read: true}}
      results = user_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 0
    end

    @query """
    query($filter: MailboxNotificationsFilter!) {
      pagedNotifications(filter: $filter) {
        entries {
          id
          action
          thread
          articleId
          title
          commentId
          read
          fromUsers {
            login
            nickname
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "can get paged notifications", ~m(user_conn user user2)a do
      mock_notification_for(user, user2)

      variables = %{filter: %{page: 1, size: 20}}
      results = user_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 1

      variables = %{filter: %{page: 1, size: 20, read: true}}
      results = user_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 0
    end
  end
end
