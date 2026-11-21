defmodule GroupherServer.CMS.Communities.Moderators.Query do
  @moduledoc """
  Pages community moderators by User identity. Membership is a scope,
  while the selected User owns order and cursor values.

      Communities -> scoped User query -> ORM.Pagi -> viewer projection
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Pagi}
  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityModerator}
  alias Helper.ORM
  alias Helper.ORM.Pagi.{Order}
  alias Pagi.Params

  @doc "Returns up to fifteen non-member accounts for the moderator picker."
  def candidates(%Community{id: id}, name) do
    memberships = from(m in CommunityModerator, where: m.community_id == ^id, select: m.user_id)

    query =
      from(user in User,
        where: user.id not in subquery(memberships),
        where: ilike(user.login, ^"%#{name}%") or ilike(user.nickname, ^"%#{name}%"),
        order_by: [desc: user.id],
        limit: 15
      )

    {:ok, GroupherServer.Repo.all(query)}
  end

  @spec page(Community.t(), map(), Params.t() | nil, User.t() | nil) :: tuple()
  def page(community, filter, pagi, viewer \\ nil)

  def page(%Community{id: id}, filter, pagi, _viewer) when not is_nil(id) do
    query =
      from(member in CommunityModerator,
        where: member.community_id == ^id,
        preload: [:community, :user]
      )

    sort = Map.get(filter, :sort, :desc_inserted)

    if sort in [:asc_inserted, :desc_inserted] do
      direction = if sort == :asc_inserted, do: :asc, else: :desc

      order = %Order{
        fields: [:inserted_at, :id],
        directions: [direction, direction],
        cursor_fields: [:inserted_at, :id]
      }

      with {:ok, page} <-
             ORM.pagi(query, pagi,
               for: CommunityModerator,
               order: order,
               surface: "communities.moderators",
               query_fingerprint: :erlang.term_to_binary({id, sort}) |> Base.encode64()
             ) do
        entries =
          Enum.map(page.entries, fn membership ->
            root = membership.is_lord

            count =
              if root,
                do: GroupherServer.CMS.Passport.Registry.root_passport_item_count(),
                else:
                  Enum.count(membership.permissions || %{}, fn {_action, enabled} ->
                    enabled == true
                  end)

            %{membership | is_root: root, passport_item_count: count}
          end)

        {:ok, %{page | entries: entries}}
      end
    else
      {:error, GroupherServer.Pagi.unsupported_sort()}
    end
  end

  def page(%Community{slug: slug}, filter, pagi, viewer) when is_binary(slug) do
    with {:ok, community} <- GroupherServer.CMS.FrontDesk.community(slug) do
      page(community, filter, pagi, viewer)
    end
  end
end
