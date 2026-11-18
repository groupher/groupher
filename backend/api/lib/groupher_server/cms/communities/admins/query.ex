defmodule GroupherServer.CMS.Communities.Admins.Query do
  @moduledoc """
  Pages public Community Admin identity projections without exposing permission facts.

      readable Community -> CommunityAdmin page -> User display fields
  """

  import Ecto.Query

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Community, CommunityAdmin}
  alias Helper.ORM
  alias Helper.ORM.Pagi.Order

  @doc "Returns a paged, permission-free Admin membership projection for a readable Community."
  def page(%Community{id: community_id}, filter, pagi) when is_integer(community_id) do
    sort = Map.get(filter, :sort, :desc_inserted)
    direction = if sort == :asc_inserted, do: :asc, else: :desc

    query =
      from(admin in CommunityAdmin,
        where: admin.community_id == ^community_id,
        preload: [:user]
      )

    with true <- sort in [:asc_inserted, :desc_inserted],
         {:ok, page} <-
           ORM.pagi(query, pagi,
             for: CommunityAdmin,
             order: %Order{
               fields: [:inserted_at, :id],
               directions: [direction, direction],
               cursor_fields: [:inserted_at, :id]
             },
             surface: "communities.admin_members",
             query_fingerprint: :erlang.term_to_binary(community_id) |> Base.encode64()
           ) do
      {:ok, %{page | entries: Enum.map(page.entries, &present_member/1)}}
    else
      false -> {:error, GroupherServer.Pagi.unsupported_sort()}
      {:error, _reason} = error -> error
    end
  end

  def page(_, _, _), do: {:error, :invalid_community}

  defp present_member(%CommunityAdmin{user: %User{} = user} = admin) do
    %{member_id: admin.id, user_id: admin.user_id, is_lord: admin.is_lord, user: user}
  end
end
