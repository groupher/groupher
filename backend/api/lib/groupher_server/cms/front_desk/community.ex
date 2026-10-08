defmodule GroupherServer.CMS.FrontDesk.Community do
  @moduledoc """
  Reads Communities and Community Tags for the CMS FrontDesk facade.

  The facade accepts public, actor-aware management, and trusted internal
  reads. Internal mode uses the existing Gate operations lifecycle policy
  behind the stable `:internal` API; callers do not pass an operations actor.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Community
        -> Gate Scope / Repo
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat

  alias CMS.Gate.Context.Scope.Community, as: CommunityContext
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Gate
  alias CMS.Model.{Community, CommunityTag}
  alias Helper.{ORM, T}

  @doc "Reads one Community by id or public slug."
  @spec read(integer() | String.t()) :: {:ok, Community.t()} | {:error, map()}
  def read(ref), do: read(ref, nil, [])

  @doc "Reads one Community with an explicit actor-aware policy mode."
  @spec read(integer() | String.t(), term(), keyword()) ::
          {:ok, Community.t()} | {:error, map()}
  def read(ref, actor, opts) when is_list(opts) do
    mode = Keyword.get(opts, :mode, :public)
    view = Keyword.get(opts, :view, :default)
    {policy_mode, actor} = effective_policy(mode, actor)

    with {:ok, _} <- validate_view(view),
         {:ok, context} <- scope_context(policy_mode),
         %Ecto.Query{} = query <- Gate.scope(Community, actor, :read, context),
         %Ecto.Query{} = query <- where_ref(query, ref),
         query <- preload(query, [:dashboard, :lifecycle, moderators: [:community, :user]]),
         {:ok, community} <- query |> Repo.one() |> done(),
         {:ok, community} <- ORM.fill_meta(community) do
      {:ok, community}
    end
  end

  defp where_ref(query, id) when is_integer(id) do
    where(query, [community], community.id == ^id)
  end

  defp where_ref(query, slug) when is_binary(slug) do
    where(query, [community], community.slug == ^slug or community.aka == ^slug)
  end

  defp where_ref(_query, _ref), do: {:error, ErrorCat.custom(%{reason: :not_exist})}

  defp scope_context(policy_mode) do
    if policy_mode in CMS.Communities.Lifecycle.read_policy_modes() do
      {:ok, CommunityContext.new(policy_mode)}
    else
      {:error, GateErrorCat.unknown_policy_mode()}
    end
  end

  defp effective_policy(:internal, _actor), do: {:operations, :operations}
  defp effective_policy(mode, actor), do: {mode, actor}

  defp validate_view(:default), do: {:ok, :pass}
  defp validate_view(_view), do: {:error, ErrorCat.custom(%{reason: :unsupported_read_view})}

  @doc "Reads one Community Tag by database id."
  @spec tag(T.id()) :: T.domain_res(CommunityTag.t())
  def tag(id), do: ORM.find(CommunityTag, id)

  @doc "Reads one Community Tag Group by database id."
  @spec tag_group(T.id()) :: T.domain_res(CMS.Model.CommunityTagGroup.t())
  def tag_group(id), do: ORM.find(CMS.Model.CommunityTagGroup, id)

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
