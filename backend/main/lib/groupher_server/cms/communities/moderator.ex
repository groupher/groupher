defmodule GroupherServer.CMS.Communities.Moderator do
  @moduledoc """
  Moderator helpers for communities.
  """

  alias Ecto.Multi

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Communities.Passport
  alias CMS.Model.{Community, CommunityModerator}
  alias CMS.{Communities, FrontDesk}
  alias Helper.{Certification, ORM, Transaction}
  alias Helper.Types, as: T

  @doc """
  set a community moderator
  """
  @spec add(Community.t(), term(), User.t(), User.t()) :: T.domain_res(term())
  def add(%Community{} = community, role, %User{} = target_user, %User{} = cur_user) do
    community = Repo.preload(community, :moderators)

    case user_is_root?(community, cur_user) do
      {:ok, true} ->
        Transaction.locking(community, fn community ->
          Multi.new()
          |> Multi.insert(
            :insert_moderator,
            CommunityModerator.changeset(%CommunityModerator{}, %{
              user_id: target_user.id,
              community_id: community.id,
              role: role
            })
          )
          |> Multi.run(:update_community_count, fn _, _ ->
            Communities.Count.update(
              community,
              target_user,
              :moderators_count,
              :inc
            )
          end)
          |> Multi.run(:stamp_passport, fn _, %{insert_moderator: community_moderator} ->
            rules = Certification.passport_rules(cms: role)

            update_passport_item_count(community_moderator, community, target_user, rules)
            Passport.stamp_passport(rules, target_user)
          end)
          |> Repo.transaction()
          |> result()
        end)

      {:error, :community_root_only} ->
        {:error, {:community_root_only, "only community root can add moderator"}}
    end
  end

  @doc """
  update community moderator
  """
  @spec update_passport(String.t() | Community.t(), term(), User.t(), User.t()) ::
          T.domain_res(term())
  def update_passport(
        community_slug,
        rules,
        %User{} = target_user,
        %User{} = cur_user
      )
      when is_binary(community_slug) do
    case FrontDesk.community(community_slug) do
      {:ok, community} ->
        update_passport(community, rules, target_user, cur_user)

      {:error, reason} ->
        {:error, reason}
    end
  end

  def update_passport(
        %Community{} = community,
        rules,
        %User{} = target_user,
        %User{} = cur_user
      ) do
    with {:ok, true} <- user_is_root?(community, cur_user),
         {:ok, :match} <- match_passport_community(community.slug, rules),
         {:ok, _} <- Passport.stamp_passport(rules, target_user) do
      update_passport_item_count(community, target_user, rules)

      Communities.Read.read(community.slug, inc_views: false)
    else
      {:error, :community_root_only} ->
        {:error, {:community_root_only, "only community root can update moderator"}}

      {:error, :passport_community_not_match} ->
        {:error, {:passport_community_not_match, "can only update passport in #{community.slug}"}}

      {:error, :one_community_only} ->
        {:error, {:one_community_only, "can only passport once community a time"}}

      _ ->
        {:error, {:custom, "update passport error"}}
    end
  end

  @doc """
  unset a community moderator
  """
  @spec remove(String.t() | Community.t(), User.t(), User.t()) :: T.domain_res(term())
  def remove(%Community{slug: community_slug}, %User{} = target_user, %User{} = cur_user) do
    remove(community_slug, target_user, cur_user)
  end

  def remove(community_slug, %User{} = target_user, %User{} = cur_user)
      when is_binary(community_slug) do
    with {:ok, community} <- FrontDesk.community(community_slug),
         {:ok, true} <- user_is_root?(community, cur_user) do
      Multi.new()
      |> Multi.run(:stamp_passport, fn _, _ ->
        Passport.erase_passport([community_slug], target_user)
      end)
      |> Multi.run(:delete_moderator, fn _, _ ->
        ORM.findby_delete!(CommunityModerator, %{
          user_id: target_user.id,
          community_id: community.id
        })
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        with {:ok, community} <- ORM.find(Community, community.id) do
          Communities.Count.update(
            community,
            target_user,
            :moderators_count,
            :dec
          )
        end
      end)
      |> Repo.transaction()
      |> result()
    else
      {:error, :community_root_only} ->
        {:error, {:community_root_only, "only community root can remove moderator"}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Helpers

  defp update_passport_item_count(%Community{} = community, %User{} = user, rules) do
    with {:ok, community_moderator} <-
           ORM.find_by(CommunityModerator, %{community_id: community.id, user_id: user.id}) do
      update_passport_item_count(community_moderator, community, user, rules)
    end
  end

  defp update_passport_item_count(
         %CommunityModerator{role: "root"} = moderator,
         _community,
         _user,
         _rules
       ) do
    moderator |> ORM.update(%{passport_item_count: Certification.root_passport_item_count()})
  end

  defp update_passport_item_count(
         %CommunityModerator{} = moderator,
         %Community{} = community,
         %User{} = user,
         rules
       ) do
    case Map.has_key?(rules, community.slug) do
      true ->
        {:ok, passport_rules} = Passport.get_passport(user)
        passport_item_count = get_in(passport_rules, [community.slug]) |> Map.keys() |> length
        moderator |> ORM.update(%{passport_item_count: passport_item_count})

      false ->
        moderator |> ORM.update(%{passport_item_count: 0})
    end
  end

  # this is for first init when create community
  defp user_is_root?(%Community{moderators: []}, %User{} = _cur_user), do: {:ok, true}

  defp user_is_root?(
         %Community{moderators: %Ecto.Association.NotLoaded{}} = community,
         %User{} = cur_user
       ) do
    community
    |> Repo.preload(:moderators)
    |> user_is_root?(cur_user)
  end

  defp user_is_root?(%Community{moderators: moderators}, %User{} = cur_user) do
    is_root =
      moderators
      |> Enum.filter(&(&1.role == "root"))
      |> Enum.any?(&(to_string(&1.user_id) == to_string(cur_user.id)))

    if is_root, do: {:ok, true}, else: {:error, :community_root_only}
  end

  defp match_passport_community(community_slug, rules) do
    community_keys = Map.keys(rules)

    case length(community_keys) == 1 do
      true ->
        passport_community = community_keys |> List.first()

        if passport_community == community_slug,
          do: {:ok, :match},
          else: {:error, :passport_community_not_match}

      _ ->
        {:error, :one_community_only}
    end
  end

  defp result({:ok, %{subscribed_community: result}}) do
    {:ok, result}
  end

  defp result({:ok, %{update_community_count: result}}) do
    {:ok, result}
  end

  defp result({:error, :stamp_passport, %Ecto.Changeset{} = result, _steps}),
    do: {:error, {:changeset, result}}

  defp result({:error, :stamp_passport, _result, _steps}),
    do: {:error, {:custom, "stamp passport error"}}

  defp result({:error, _, result, _steps}) do
    {:error, result}
  end
end
