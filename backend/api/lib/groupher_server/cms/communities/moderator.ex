defmodule GroupherServer.CMS.Communities.Moderator do
  @moduledoc """
  Owns only the community-initialization moderator workflow.

  Authenticated moderator mutations live in `Commands.Moderator` and use
  `ModeratorPersist` under the CMS Command/Gate transaction owner. This module
  intentionally has no public add/remove/update mutation API; `add_root/2` is
  reserved for creating a community before its first root moderator exists.

      Community create workflow
        -> community transaction
        -> add_root/2
        -> membership / count / root passport
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.{Communities, Passport}
  alias CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias CMS.Model.{Community, CommunityModerator}
  alias CMS.Passport.Registry
  alias GroupherServerWeb.ErrorCat
  alias Helper.{Multi, ORM, PermissionConfig, T, Transaction}

  @doc "Adds the first root moderator while a community is being created."
  @spec add_root(Community.t(), User.t()) :: T.domain_res(term())
  def add_root(%Community{} = community, %User{} = target_user) do
    Transaction.lock_row(community, fn community ->
      Multi.new()
      |> insert_and_stamp_root(community, target_user)
      |> Repo.transaction()
      |> result()
    end)
  end

  defp insert_and_stamp_root(
         multi,
         %Community{} = community,
         %User{} = target_user
       ) do
    insert_name = {:insert_moderator, target_user.id}

    multi
    |> Multi.insert(
      insert_name,
      CommunityModerator.changeset(%CommunityModerator{}, %{
        user_id: target_user.id,
        community_id: community.id
      })
    )
    |> Multi.run({:update_community_count, target_user.id}, fn _, _ ->
      with {:ok, community} <- ORM.find(Community, community.id) do
        Communities.Count.update(community, target_user, :moderators_count, :inc)
      end
    end)
    |> Multi.run({:stamp_passport, target_user.id}, fn _, changes ->
      community_moderator = Map.fetch!(changes, insert_name)

      with {:ok, rules} <- PermissionConfig.default_root_passport(community.slug),
           {:ok, _} <- Passport.stamp_passport(rules, target_user) do
        update_passport_item_count(community_moderator, community, rules)
      end
    end)
  end

  defp update_passport_item_count(
         %CommunityModerator{} = moderator,
         %Community{} = community,
         rules
       ) do
    count =
      case get_in(rules, [community.slug]) do
        %{"root" => true} ->
          Registry.root_passport_item_count()

        %{"cms" => cms_rules} when is_map(cms_rules) ->
          Enum.count(cms_rules, fn {_rule, enabled} -> enabled == true end)

        %{cms: cms_rules} when is_map(cms_rules) ->
          Enum.count(cms_rules, fn {_rule, enabled} -> enabled == true end)

        _ ->
          0
      end

    ORM.update(moderator, %{passport_item_count: count})
  end

  defp result({:ok, changes}) when is_map(changes) do
    changes
    |> Enum.find_value(fn
      {{:update_community_count, _user_id}, result} -> result
      _ -> nil
    end)
    |> case do
      nil -> {:ok, changes}
      result -> {:ok, result}
    end
  end

  defp result({:error, {:stamp_passport, _user_id}, %Ecto.Changeset{} = result, _steps}) do
    {:error, ErrorCat.changeset(result)}
  end

  defp result({:error, {:stamp_passport, _user_id}, _result, _steps}) do
    {:error, CommunityErrorCat.custom("stamp passport error")}
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
