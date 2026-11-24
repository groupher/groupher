defmodule GroupherServer.CMS.Communities.Subscribers.Query do
  @moduledoc """
  Pages community subscribers by User identity. Membership is a scope,
  while the selected User owns order and cursor values.

      Communities -> scoped User query -> ORM.Pagi -> viewer projection
  """

  import Ecto.Query

  alias GroupherServer.Accounts
  alias GroupherServer.{CMS, Pagi}
  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunitySubscriber}
  alias Helper.ORM
  alias Helper.ORM.Pagi.{Order}
  alias Pagi.Params

  @doc "Pages subscribers for a Community reference, applying viewer-specific fields when present."
  @spec page(Community.t(), map(), Params.t() | nil, User.t() | nil) :: tuple()
  def page(community, filter, pagi, viewer \\ nil)

  def page(%Community{id: id}, filter, pagi, viewer) when not is_nil(id) do
    members =
      from(member in CommunitySubscriber,
        where: member.community_id == ^id,
        select: member.user_id
      )

    query = from(user in User, where: user.id in subquery(members))
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
               for: User,
               order: order,
               surface: "communities.subscribers",
               query_fingerprint: :erlang.term_to_binary({id, sort}) |> Base.encode64()
             ) do
        case viewer do
          %User{} -> {:ok, Accounts.fans_mark_viewer_follow_status({:ok, page}, viewer)}
          nil -> {:ok, page}
        end
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
