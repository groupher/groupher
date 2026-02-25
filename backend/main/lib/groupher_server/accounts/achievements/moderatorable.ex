defmodule GroupherServer.Accounts.Achievements.Moderatorable do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.FrontDesk
  alias Accounts.Model.User
  alias CMS.Model.CommunityModerator
  alias Helper.ORM

  def paged_moderatorable_communities(%User{id: user_id}, %{page: page, size: size}) do
    with {:ok, user} <- FrontDesk.user(user_id) do
      CommunityModerator
      |> where([e], e.user_id == ^user.id)
      |> join(:inner, [e], c in assoc(e, :community))
      |> select([e, c], c)
      |> ORM.paginator(page: page, size: size)
      |> done()
    end
  end
end
