defmodule GroupherServer.CMS.Communities.Commands.Moderator do
  @moduledoc """
  Concrete CMS Commands for community moderator mutations.

  `ModeratorPersist` contains only transaction-free writes for the command
  callback; setup keeps its separate `add_root` workflow. Admission, identity
  and Receipt recovery belong here; AddMany intentionally records per-user
  outcomes instead of rolling back successful targets when another target is
  invalid.

      GraphQL -> Moderator Command -> Gate -> ModeratorPersist -> Receipt
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Communities.ModeratorPersist, as: Persist
  alias CMS.Communities.Commands.ModeratorConfirmation, as: Confirmation
  alias CMS.FrontDesk
  alias CMS.Model.Community
  alias Helper.T

  @spec add(Community.t(), User.t(), User.t(), Ecto.UUID.t()) :: T.domain_res(Community.t())
  def add(%Community{} = community, %User{} = target, %User{} = actor, command_id) do
    execute(
      :moderator_add,
      community,
      actor,
      %{target_user_id: target.id},
      command_id,
      fn canonical ->
        Persist.add(canonical, target, actor)
      end
    )
  end

  @spec add_many(Community.t(), [User.t()], User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def add_many(%Community{} = community, targets, %User{} = actor, command_id)
      when is_list(targets) do
    execute(
      :moderator_add_many,
      community,
      actor,
      %{target_user_ids: Enum.map(targets, & &1.id)},
      command_id,
      fn canonical -> Persist.add_many(canonical, targets, actor) end
    )
  end

  @spec remove(Community.t(), User.t(), User.t(), Ecto.UUID.t()) :: T.domain_res(Community.t())
  def remove(%Community{} = community, %User{} = target, %User{} = actor, command_id) do
    execute(
      :moderator_remove,
      community,
      actor,
      %{target_user_id: target.id},
      command_id,
      fn canonical ->
        Persist.remove(canonical, target, actor)
      end
    )
  end

  @spec update_passport(Community.t(), map(), User.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def update_passport(
        %Community{} = community,
        rules,
        %User{} = target,
        %User{} = actor,
        command_id
      ) do
    execute(
      :moderator_update,
      community,
      actor,
      %{target_user_id: target.id, rules: rules},
      command_id,
      fn canonical -> Persist.update_passport(canonical, rules, target, actor) end
    )
  end

  defp execute(operation, community, actor, params, command_id, callback) do
    command = %CMS.Command{
      actor: actor,
      command_id: command_id,
      operation: operation,
      target: community,
      params: command_params(operation, community, params)
    }

    with {:ok, confirmation} <-
           CMS.Command.execute(command,
             action: fn %{target: canonical, command_id: id} ->
               with {:ok, result} <-
                      CMS.Gate.with_community_check(actor, :update, canonical, callback),
                    {:ok, results} <- normalize_results(result, params) do
                 {:ok,
                  %Confirmation{
                    data: %{
                      "community_id" => canonical.id,
                      "command_id" => id,
                      "results" => results
                    }
                  }}
               end
             end,
             confirmation: Confirmation
           ) do
      present(confirmation)
    end
  end

  defp normalize_results(results, _params) when is_list(results), do: {:ok, results}

  defp normalize_results(_result, %{target_user_id: user_id}),
    do: {:ok, [%{"user_id" => user_id, "ok" => true, "error" => nil}]}

  defp command_params(:moderator_add, community, %{target_user_id: id}),
    do: %{community_id: community.id, target_user_id: id}

  defp command_params(:moderator_remove, community, %{target_user_id: id}),
    do: %{community_id: community.id, target_user_id: id}

  defp command_params(:moderator_update, community, %{target_user_id: id, rules: rules}),
    do: %{community_id: community.id, target_user_id: id, rules: rules}

  defp command_params(:moderator_add_many, community, %{target_user_ids: ids}),
    do: %{community_id: community.id, target_user_ids: ids}

  defp present(%Confirmation{
         data: %{"community_id" => id, "command_id" => command_id, "results" => results}
       }) do
    case Repo.get(Community, id) do
      %Community{slug: slug} ->
        with {:ok, community} <- FrontDesk.community(slug, mode: :internal) do
          {:ok, %{community | command_id: command_id, moderator_results: results}}
        end

      nil ->
        {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end
end
