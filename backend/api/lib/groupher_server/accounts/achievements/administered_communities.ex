defmodule GroupherServer.Accounts.Achievements.AdministeredCommunities do
  @moduledoc """
  Lists Communities where a user has current Admin membership.

  This backs account profile surfaces without exposing membership rows directly.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> AdministeredCommunities
        -> Repo
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityAdmin}
  alias Helper.{ORM, T}
  alias Helper.ORM.Pagi.{Order}
  alias GroupherServer.{Pagi}
  alias Pagi.Params

  @doc """
  Returns Communities where a user has current Admin membership.

  ## Examples

      Accounts.Achievements.AdministeredCommunities.paged_administered_communities(user, %{page: 1, size: 20})
  """
  @spec paged_administered_communities(User.t(), Params.t() | nil) ::
          T.domain_res(T.paged_data())
  def paged_administered_communities(%User{id: user_id}, pagi) do
    ids =
      from(member in CommunityAdmin,
        where: member.user_id == ^user_id,
        select: member.community_id
      )

    query = from(community in Community, where: community.id in subquery(ids))

    ORM.pagi(query, pagi,
      for: Community,
      order: %Order{fields: [:id], directions: [:desc], cursor_fields: [:id]},
      surface: "accounts.administered_communities",
      query_fingerprint: Integer.to_string(user_id)
    )
  end
end
