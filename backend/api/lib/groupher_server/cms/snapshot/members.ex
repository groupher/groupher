defmodule GroupherServer.CMS.Snapshot.Members do
  @moduledoc """
  Maintains bounded display snapshots using stable account IDs.

      effective participation facts -> ordered users -> bounded Embeds.User list

  This pure boundary does not query relationships, refresh profiles or update counts.
  Callers supply effective users in newest-fact order when rebuilding a summary.
  """

  alias GroupherServer.CMS.Model.Embeds.User

  @doc "Normalizes, deduplicates and bounds an already ordered participant list."
  @spec bounded([map()], pos_integer()) :: {:ok, [User.t()]} | {:error, atom()}
  def bounded(users, limit) when is_list(users) and is_integer(limit) and limit > 0 do
    normalized = Enum.map(users, &User.normalize/1)

    if Enum.all?(normalized, &valid_identity?/1) do
      {:ok, normalized |> Enum.uniq_by(& &1.id) |> Enum.take(limit)}
    else
      {:error, :invalid_participant_snapshot}
    end
  end

  def bounded(_, _), do: {:error, :invalid_participant_snapshot}

  @doc "Moves one changed participant to the front without duplicating their ID."
  @spec promote([map()], map(), pos_integer()) :: {:ok, [User.t()]} | {:error, atom()}
  def promote(users, user, limit) when is_list(users), do: bounded([user | users], limit)
  def promote(_, _, _), do: {:error, :invalid_participant_snapshot}

  @doc "Removes an account without changing the relative order of remaining members."
  @spec remove([map()], pos_integer(), pos_integer()) :: {:ok, [User.t()]} | {:error, atom()}
  def remove(users, user_id, limit)
      when is_list(users) and is_integer(user_id) and user_id > 0 and is_integer(limit) and
             limit > 0 do
    with {:ok, normalized} <- bounded(users, max(length(users), limit)) do
      normalized |> Enum.reject(&(&1.id == user_id)) |> bounded(limit)
    end
  end

  def remove(_, _, _), do: {:error, :invalid_participant_snapshot}

  defp valid_identity?(%User{id: id, user_id: id} = user) when is_integer(id) and id > 0 do
    User.valid?(user)
  end

  defp valid_identity?(_), do: false
end
