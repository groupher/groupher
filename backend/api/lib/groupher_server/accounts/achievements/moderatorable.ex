defmodule GroupherServer.Accounts.Achievements.Moderatorable do
  @moduledoc """
  Lists communities where a user has moderator capability.

  This backs account achievement/profile surfaces that need to show moderation
  reach without exposing the join rows directly.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Moderatorable
        -> Repo
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityModerator}
  alias Helper.{ORM, T}
  alias Helper.ORM.Pagi.{Order}
  alias GroupherServer.{Pagi}
  alias Pagi.Params

  @doc """
  Returns communities where a user has moderator capability.

  ## Examples

      Accounts.Achievements.Moderatorable.paged_moderatorable_communities(user, %{page: 1, size: 20})
  """
  @spec paged_moderatorable_communities(User.t(), Params.t() | nil) ::
          T.domain_res(T.paged_data())
  def paged_moderatorable_communities(%User{id: user_id}, pagi) do
    ids =
      from(member in CommunityModerator,
        where: member.user_id == ^user_id,
        select: member.community_id
      )

    query = from(community in Community, where: community.id in subquery(ids))

    ORM.pagi(query, pagi,
      for: Community,
      order: %Order{fields: [:id], directions: [:desc], cursor_fields: [:id]},
      surface: "accounts.moderatorable_communities",
      query_fingerprint: Integer.to_string(user_id)
    )
  end
end
