defmodule GroupherServer.CMS.Communities.Moderators.Commands.Support do
  require GroupherServer.CMS.Gate.ErrorCat

  @moduledoc """
  Shared execution boundary for concrete Moderator Commands.

  Each public action supplies its own operation and callback; this module keeps
  the Receipt/Confirmation and canonical presentation mechanics in one place.

      Moderator Command
        -> CMS.Command Receipt
        -> CMS.Gate
        -> Moderators.Persist
        -> Confirmation / canonical Community
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias CMS.Communities.Moderators.Commands.Confirmation
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.Community
  alias Helper.T

  @type callback :: (Community.t() -> T.domain_res(term()))

  @spec execute(atom(), Community.t(), User.t(), map(), Ecto.UUID.t(), callback()) ::
          T.domain_res(Community.t())
  def execute(operation, %Community{} = community, %User{} = actor, params, command_id, callback)
      when is_function(callback, 1) do
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
               case CMS.Gate.with_community_check(
                      actor,
                      :manage_moderators,
                      canonical,
                      callback
                    ) do
                 {:ok, result} ->
                   with {:ok, results} <- normalize_results(result, params) do
                     {:ok,
                      %Confirmation{
                        data: %{
                          "community_id" => canonical.id,
                          "command_id" => id,
                          "results" => results
                        }
                      }}
                   end

                 {:error, GateErrorCat.error_pattern(reason: :permission_denied)} ->
                   {:error,
                    CommunityErrorCat.community_root_only(
                      "only community root can manage moderators"
                    )}

                 {:error, reason} ->
                   {:error, reason}
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
