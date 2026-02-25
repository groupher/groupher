defmodule GroupherServer.Accounts.Profiles.Subscribe do
  @moduledoc false

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.CommunitySubscriber
  alias Helper.ORM

  def update_subscribe_state(%User{} = user) do
    query =
      from(s in CommunitySubscriber,
        where: s.user_id == ^user.id,
        join: c in assoc(s, :community),
        select: c.id
      )

    subscribed_communities_ids = query |> Repo.all()
    subscribed_communities_count = subscribed_communities_ids |> length()

    {:ok, user} = ORM.update(user, %{subscribed_communities_count: subscribed_communities_count})
    ORM.update_meta(user, %{subscribed_communities_ids: subscribed_communities_ids})
  end
end
