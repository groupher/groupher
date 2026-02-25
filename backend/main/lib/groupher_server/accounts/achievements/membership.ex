defmodule GroupherServer.Accounts.Achievements.Membership do
  @moduledoc false

  import ShortMaps

  alias GroupherServer.Accounts.Model.{Achievement, User}
  alias Helper.ORM

  def set_member(%User{} = user, :donate), do: do_set_member(user, %{donate_member: true})
  def set_member(%User{} = user, :senior), do: do_set_member(user, %{senior_member: true})
  def set_member(%User{} = user, :sponsor), do: do_set_member(user, %{sponsor_member: true})
  def set_member(_user, _plan), do: {:ok, :pass}

  defp do_set_member(%User{id: user_id}, attrs) do
    with {:ok, achievement} <- ORM.findby_or_insert(Achievement, ~m(user_id)a, ~m(user_id)a) do
      achievement |> ORM.update(attrs)
    end
  end
end
