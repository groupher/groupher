defmodule GroupherServer.Accounts.Achievements.Membership do
  @moduledoc false

  import ShortMaps

  alias GroupherServer.Accounts.Model.{Achievement, User}
  alias Helper.{ORM, Transaction}

  def set_member(%User{} = user, :donate), do: do_set_member(user, %{donate_member: true})
  def set_member(%User{} = user, :senior), do: do_set_member(user, %{senior_member: true})
  def set_member(%User{} = user, :sponsor), do: do_set_member(user, %{sponsor_member: true})
  def set_member(_user, _plan), do: {:ok, :pass}

  defp do_set_member(%User{id: user_id}, attrs) do
    Transaction.lock_global("achievement:user:#{user_id}", fn ->
      with {:ok, _} <- ORM.upsert_by(Achievement, ~m(user_id)a, ~m(user_id)a),
           {:ok, achievement} <- ORM.find_by(Achievement, ~m(user_id)a) do
        achievement |> ORM.update(attrs)
      end
    end)
    |> case do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end
end
