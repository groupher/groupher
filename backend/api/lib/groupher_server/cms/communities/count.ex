defmodule GroupherServer.CMS.Communities.Count do
  @moduledoc """
  Count helpers for communities.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Count
        -> Repo / Oban
  """

  import Ecto.Query, only: [from: 2, where: 3]
  import Helper.Utils, only: [plural: 1, strip_struct: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Communities.ErrorCat
  alias CMS.Model.{Article, Community, CommunityTag}
  alias Helper.{ORM, T, Transaction}

  @threads CMS.Communities.Config.threads()

  @doc """
  update community_tags_count / thread / article_count / subscribers_count of a community
  """
  @spec update(Community.t(), User.t(), atom(), atom()) :: T.domain_res(Community.t())
  def update(
        %Community{} = community,
        %User{} = user,
        :admins_count,
        opt
      ) do
    with {:ok, community} <- ORM.fill_meta(community) do
      admins_ids =
        case opt do
          :inc -> (community.meta.admins_ids ++ [user.id]) |> Enum.uniq()
          :dec -> (community.meta.admins_ids -- [user.id]) |> Enum.uniq()
        end

      with {:ok, community} <- ORM.update_meta(community, %{admins_ids: admins_ids}) do
        ORM.update(community, %{admins_count: length(admins_ids)})
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

  @doc "Recounts a Community's category-tag total and persists the updated counter."
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
      false -> {:error, ErrorCat.custom("update_community_count_field")}
    end
  end

  @spec update(Community.t(), atom()) :: T.domain_res(Community.t())
  def update(%Community{} = community, thread) do
    if thread in @threads do
      context =
        if thread == :doc do
          CMS.Gate.Context.Scope.Doc.public()
        else
          CMS.Gate.Context.Scope.Article.public(thread)
        end

      # Doc report-only expectations mirror this Scope + Trash + Binding count in
      # CMS.Articles.Query.PublicReadReport.community_counts; keep both aligned.
      query =
        Article
        |> CMS.Articles.Trash.not_trashed_scope(thread)
        |> CMS.Gate.scope(nil, :list, context)
        |> then(fn scoped ->
          from([gate_community: scoped_community] in scoped,
            where: scoped_community.id == ^community.id
          )
        end)

      thread_article_count = Repo.aggregate(query, :count, :id)

      Transaction.lock_row(community, fn community ->
        with {:ok, community} <- ORM.fill_meta(community),
             meta <- Map.put(community.meta, :"#{plural(thread)}_count", thread_article_count),
             {:ok, community} <- ORM.update_meta(community, meta) do
          ORM.update(community, %{articles_count: recount_articles_count(community.meta)})
        end
      end)
    else
      {:error, ErrorCat.custom("invalid article thread")}
    end
  end

  @doc "Stores the inner resource ID index for a Community thread in its metadata."
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

  def count(%Community{id: id}, :community_tags) do
    with {:ok, community} <- ORM.find(Community, id) do
      result =
        CommunityTag
        |> where([t], t.community_id == ^community.id)
        |> Repo.aggregate(:count)

      {:ok, result}
    end
  end

  def count(_community, _type), do: {:error, ErrorCat.custom("invalid count type")}

  defp recount_articles_count(meta) do
    @threads |> Enum.reduce(0, &(&2 + Map.get(meta, :"#{plural(&1)}_count")))
  end
end
