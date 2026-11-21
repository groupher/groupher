defmodule GroupherServer.Messaging.Notices do
  @moduledoc """
  Internal facade for Notice reads and grouped activity persistence.

  Public application code enters through `Messaging`; query and persistence
  primitives are delegated here to keep the storage modules behind that API.

      Messaging -> Notices -> Query / Persist -> notices
  """

  alias __MODULE__.{Persist, Query}

  @doc """
  Returns a page of notices for one recipient.

  ## Examples

      Notices.paged(user, %{read: false}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  defdelegate paged(user, filter, pagi), to: Query

  @doc """
  Counts unread notices for one recipient.

  ## Examples

      Notices.unread_count(user.id)
  """
  defdelegate unread_count(user_id), to: Query

  @doc """
  Counts unread notices for a set of recipients.

  ## Examples

      Notices.unread_counts([user.id, another_user.id])
  """
  defdelegate unread_counts(user_ids), to: Query

  @doc """
  Creates or merges one grouped activity notice.

  ## Examples

      Notices.upsert(%{type: :follow, user_id: recipient.id}, actor)
  """
  defdelegate upsert(attrs, from_user), to: Persist

  @doc """
  Finds grouped notices containing the actor contribution to revoke.

  ## Examples

      Notices.find_for_revoke(%{type: :follow, user_id: recipient.id}, actor)
  """
  defdelegate find_for_revoke(attrs, from_user), to: Persist

  @doc """
  Removes an actor contribution from the selected grouped notices.

  ## Examples

      Notices.revoke_rows(notices, actor)
  """
  defdelegate revoke_rows(notifications, from_user), to: Persist

  @doc """
  Checks whether activity attributes satisfy the registered type requirements.

  ## Examples

      Notices.valid?(%{type: :follow, user_id: recipient.id})
  """
  defdelegate valid?(attrs), to: Persist
end
