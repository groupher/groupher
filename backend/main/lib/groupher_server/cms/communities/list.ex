defmodule GroupherServer.CMS.Communities.List do
  @moduledoc """
  List helpers for communities.
  """

  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.Community
  alias Helper.ORM
  alias Helper.Types, as: T

  @spec page(map(), User.t()) :: T.domain_res(term())
  def page(filter, %User{meta: meta}) do
    with {:ok, paged_communities} <- page(filter) do
      %{entries: entries} = paged_communities

      entries =
        Enum.map(entries, fn community ->
          viewer_has_subscribed = community.id in meta.subscribed_communities_ids
          %{community | viewer_has_subscribed: viewer_has_subscribed}
        end)

      %{paged_communities | entries: entries} |> done
    end
  end

  @spec page(map()) :: T.domain_res(term())
  def page(filter) do
    filter = filter |> Enum.reject(fn {_k, v} -> is_nil(v) end) |> Enum.into(%{})
    Community |> ORM.find_all(filter)
  end
end
