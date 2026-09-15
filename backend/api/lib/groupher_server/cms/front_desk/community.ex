defmodule GroupherServer.CMS.FrontDesk.Community do
  @moduledoc """
  Reads public Communities and Community Tags for the CMS FrontDesk facade.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Community
        -> Gate Scope / Repo
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat

  alias CMS.Gate.Context.Scope.Community, as: CommunityContext
  alias CMS.Model.{Community, CommunityTag}
  alias Helper.{ORM, T}

  @doc "Reads one public Community by slug or alias."
  @spec read(String.t()) :: {:ok, Community.t()} | {:error, map()}
  def read(slug) when is_binary(slug) do
    CMS.Gate.scope(Community, nil, :read, CommunityContext.public())
    |> where([community], community.slug == ^slug or community.aka == ^slug)
    |> preload(:dashboard)
    |> preload(:lifecycle)
    |> preload(moderators: [:community, :user])
    |> Repo.one()
    |> done()
    |> case do
      {:ok, community} -> ORM.fill_meta(community)
      {:error, _} = error -> error
    end
  end

  @doc "Reads one Community Tag by database id."
  @spec tag(T.id()) :: T.domain_res(CommunityTag.t())
  def tag(id), do: ORM.find(CommunityTag, id)

  @doc "Reads one Community Tag by public Community/thread/slug coordinates."
  @spec tag(String.t(), atom(), String.t()) :: T.domain_res(CommunityTag.t())
  def tag(community, thread, slug) do
    with {:ok, community} <- read(community) do
      ORM.find_by(CommunityTag, community_id: community.id, thread: thread, slug: slug)
    end
  end

  @doc "Reads Community Tags in the caller's requested id order."
  @spec tags([T.id()]) :: T.domain_res([CommunityTag.t()])
  def tags(tag_ids) when is_list(tag_ids) do
    positions =
      tag_ids
      |> Enum.with_index()
      |> Map.new(fn {id, index} -> {to_string(id), index} end)

    CommunityTag
    |> where([tag], tag.id in ^tag_ids)
    |> Repo.all()
    |> Enum.sort_by(&Map.get(positions, to_string(&1.id), 9_999_999))
    |> done()
  end

  defp done(nil), do: {:error, ErrorCat.custom(%{reason: :not_exist})}
  defp done(result), do: {:ok, result}
end
