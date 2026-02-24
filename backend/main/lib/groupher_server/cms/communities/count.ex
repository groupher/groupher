defmodule GroupherServer.CMS.Communities.Count do
  @moduledoc """
  Count helpers for communities.
  """
  import Ecto.Query, only: [from: 2, where: 3]
  import Helper.Utils, only: [get_config: 2, plural: 1, strip_struct: 1]
  import GroupherServer.CMS.Helper.Matcher

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityTag}
  alias Helper.Types, as: T
  alias Helper.{Constant, ORM, Transaction}

  @article_threads get_config(:article, :threads)

  @doc """
  update community_tags_count / thread / article_count / subscribers_count of a community
  """
  @spec update(Community.t(), User.t(), atom(), atom()) :: T.domain_res(Community.t())
  def update(
        %Community{} = community,
        %User{} = user,
        :moderators_count,
        opt
      ) do
    with {:ok, community} <- ORM.fill_meta(community) do
      moderators_ids =
        case opt do
          :inc -> (community.meta.moderators_ids ++ [user.id]) |> Enum.uniq()
          :dec -> (community.meta.moderators_ids -- [user.id]) |> Enum.uniq()
        end

      with {:ok, community} <- ORM.update_meta(community, %{moderators_ids: moderators_ids}) do
        ORM.update(community, %{moderators_count: length(moderators_ids)})
      end
    end
  end

  def update(
        %Community{} = community,
        %User{} = user,
        :subscribers_count,
        opt
      ) do
    with {:ok, community} <- ORM.fill_meta(community) do
      subscribed_user_ids =
        case opt do
          :inc -> (community.meta.subscribed_user_ids ++ [user.id]) |> Enum.uniq()
          :dec -> (community.meta.subscribed_user_ids -- [user.id]) |> Enum.uniq()
        end

      with {:ok, community} <-
             ORM.update_meta(community, %{subscribed_user_ids: subscribed_user_ids}) do
        ORM.update(community, %{subscribers_count: length(subscribed_user_ids)})
      end
    end
  end

  @spec update(Community.t(), atom()) :: T.domain_res(Community.t())
  def update(%Community{} = community, :community_tags_count) do
    {:ok, community_tags_count} =
      from(t in CommunityTag, where: t.community_id == ^community.id) |> ORM.count()

    community
    |> Ecto.Changeset.change(%{community_tags_count: community_tags_count})
    |> Repo.update()
  end

  @spec update([Community.t()], atom()) :: T.domain_res(atom())
  def update(communities, thread) when is_list(communities) do
    case Enum.all?(Enum.uniq(communities), &({:ok, _} = update(&1, thread))) do
      true -> {:ok, :pass}
      false -> {:error, {:custom, "update_community_count_field"}}
    end
  end

  @spec update(Community.t(), atom()) :: T.domain_res(Community.t())
  def update(%Community{} = community, thread) do
    with {:ok, info} <- match(thread) do
      {:ok, thread_article_count} =
        from(a in info.model,
          join: c in assoc(a, :communities),
          where: a.mark_delete == false and c.id == ^community.id
        )
        |> ORM.count(prefix: Constant.DBPrefix.cms())

      meta = Map.put(community.meta, :"#{plural(thread)}_count", thread_article_count)

      Transaction.locking(community, fn community ->
        with {:ok, community} <- ORM.update_meta(community, meta) do
          ORM.update(community, %{articles_count: recount_articles_count(community.meta)})
        end
      end)
    end
  end

  @spec update_inner_id(Community.t(), atom(), map()) :: T.domain_res(Community.t())
  def update_inner_id(
        %Community{meta: community_meta} = community,
        thread,
        %{inner_id: inner_id}
      ) do
    thread_inner_id_key = :"#{plural(thread)}_inner_id_index"
    meta = community_meta |> Map.put(thread_inner_id_key, inner_id) |> strip_struct

    ORM.update_meta(community, meta)
  end

  @doc "count items in community"
  @spec count(Community.t(), atom()) :: T.domain_res(integer())
  def count(community, type)

  def count(%Community{id: id}, :threads) do
    with {:ok, community} <- ORM.find(Community, id, preload: :threads) do
      {:ok, length(community.threads)}
    end
  end

  def count(%Community{id: id}, :community_tags) do
    with {:ok, community} <- ORM.find(Community, id) do
      result =
        CommunityTag
        |> where([t], t.community_id == ^community.id)
        |> ORM.paginator(page: 1, size: 1)

      {:ok, result.total_count}
    end
  end

  def count(_community, _type), do: {:error, {:custom, "invalid count type"}}

  defp recount_articles_count(meta) do
    @article_threads |> Enum.reduce(0, &(&2 + Map.get(meta, :"#{plural(&1)}_count")))
  end
end
