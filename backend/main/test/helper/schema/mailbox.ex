defmodule GroupherServer.Test.Helper.Schema.Mailbox do
  @moduledoc "GraphQL documents used by mailbox tests."

  def m(:mark_read) do
    """
    mutation($type: MailboxType, $ids: [ID]) {
          markRead(ids: $ids, type: $type) {
            done
          }
        }
    """
  end

  def m(:mark_read_all) do
    """
    mutation($type: MailboxType) {
          markReadAll(type: $type) {
            done
          }
        }
    """
  end

  def q(:user) do
    """
    query($login: String!) {
          user(login: $login) {
            login
            mailbox {
              isEmpty
              unreadTotalCount
              unreadMentionsCount
              unreadNotificationsCount
            }
          }
        }
    """
  end

  def q(:paged_mentions) do
    """
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
  end

  def q(:paged_notifications) do
    """
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
  end
end
