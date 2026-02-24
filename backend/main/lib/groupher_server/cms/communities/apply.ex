defmodule GroupherServer.CMS.Communities.Apply do
  @moduledoc """
  Apply helpers for communities.
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Communities
  alias CMS.Model.Community
  alias Helper.Types, as: T
  alias Helper.{Constant, ORM}

  @community_normal Constant.CMS.pending(:normal)
  @community_applying Constant.CMS.pending(:applying)
  @default_apply_category Constant.CMS.apply_category(:web)

  @spec apply(map(), User.t()) :: T.domain_res(term())
  def apply(args, %User{} = user) do
    with {:ok, community} <-
           Communities.Write.create(Map.merge(args, %{pending: @community_applying}), user) do
      apply_msg = Map.get(args, :apply_msg, "")
      apply_category = Map.get(args, :apply_category, @default_apply_category)

      meta = community.meta |> Map.merge(~m(apply_msg apply_category)a)
      ORM.update_meta(community, meta)
    end
  end

  @spec approve(String.t()) :: T.domain_res(term())
  def approve(slug) do
    # TODO: create community with thread, category and tags
    with {:ok, community} <- ORM.find_by(Community, slug: slug) do
      ORM.update(community, %{pending: @community_normal})
    end
  end

  @spec deny(T.id()) :: T.domain_res(term())
  def deny(id) do
    with {:ok, community} <- ORM.find(Community, id) do
      case community.pending == @community_applying do
        true -> ORM.delete(community)
        false -> {:ok, community}
      end
    end
  end

  @spec has_pending?(User.t()) :: T.domain_res(term())
  def has_pending?(%User{} = user) do
    with {:ok, paged_applies} <- paged_applies(user, %{page: 1, size: 1}) do
      case paged_applies.total_count > 0 do
        true -> {:ok, %{exist: true}}
        false -> {:ok, %{exist: false}}
      end
    end
  end

  def paged_applies(%User{} = user, %{page: page, size: size} = _filter) do
    Community
    |> where([c], c.pending == ^@community_applying)
    |> where([c], c.user_id == ^user.id)
    |> ORM.paginator(~m(page size)a)
    |> done
  end
end
