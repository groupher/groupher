defmodule GroupherServer.CMS.Seeds.CleanUp do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.CMS

  alias CMS.Model.{Community, Post}
  alias Helper.{ORM, T}

  @spec community(atom()) :: T.domain_res(Community.t())
  def community(slug) do
    with {:ok, community} <- ORM.findby_delete(Community, %{slug: to_string(slug)}) do
      articles(community, :post)
    end
  end

  @spec articles(Community.t(), atom()) :: T.domain_res(:ok)
  def articles(%Community{} = community, :post) do
    Post
    |> join(:inner, [p], c in assoc(p, :community))
    |> where([p, c], c.id == ^community.id)
    |> ORM.delete_all(:if_exist)
    |> done
  end

  def articles(_, _), do: {:ok, :pass}
end
