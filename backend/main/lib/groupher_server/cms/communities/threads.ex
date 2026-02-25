defmodule GroupherServer.CMS.Communities.Threads do
  @moduledoc """
  Thread helpers for communities.
  """
  import ShortMaps

  alias GroupherServer.CMS

  alias CMS.Model.{Community, CommunityThread, Thread}
  alias Helper.{ORM, T}

  @spec create(map()) :: T.domain_res(term())
  def create(attrs) do
    slug = to_string(attrs.slug)
    title = attrs.title
    index = attrs |> Map.get(:index, 0)

    Thread |> ORM.create(~m(title slug index)a)
  end

  @doc """
  set to thread to a community
  """
  @spec set(Community.t(), Thread.t()) :: T.domain_res(term())
  def set(%Community{} = community, %Thread{} = thread) do
    attrs = %{community_id: community.id, thread_id: thread.id}

    with {:ok, community_thread} <- ORM.create(CommunityThread, attrs) do
      Community |> ORM.find(community_thread.community_id)
    end
  end

  @doc """
  unset to thread to a community
  """
  @spec unset(Community.t(), Thread.t()) :: T.domain_res(term())
  def unset(%Community{} = community, %Thread{} = thread) do
    with {:ok, community_thread} <-
           ORM.findby_delete!(CommunityThread, %{community_id: community.id, thread_id: thread.id}) do
      Community |> ORM.find(community_thread.community_id)
    end
  end
end
