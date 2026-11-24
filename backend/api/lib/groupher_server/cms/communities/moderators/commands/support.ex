defmodule GroupherServer.CMS.Communities.Moderators.Commands.Support do
  @moduledoc """
  Shared execution boundary for concrete Moderator Commands.

  Each public action supplies its own operation and callback; this module keeps
  the Receipt/Confirmation and canonical presentation mechanics in one place.

      Moderator pipeline
        -> Gate
        -> Moderators.Persist
        -> Confirmation / canonical Community
  """

  require GroupherServer.CMS.Gate.ErrorCat

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Communities.{ErrorCat, Moderators.Commands.Confirmation}
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Gate.Decision
  alias CMS.Model.Community
  @doc false
  def check_in_transaction(%User{} = actor, %Community{} = community) do
    case CMS.Gate.check_in_transaction(actor, :manage_moderators, community) do
      {:error, %Decision{allowed: false} = decision} ->
        case Decision.primary_reason(decision) do
          :permission_denied ->
            {:error, ErrorCat.community_root_only("only community root can manage moderators")}

          _ ->
            {:error, decision}
        end

      {:error, GateErrorCat.error_pattern(reason: :permission_denied)} ->
        {:error, ErrorCat.community_root_only("only community root can manage moderators")}

      result ->
        result
    end
  end

  @doc false
  def confirmation(%Community{} = community, command_id, result, params) do
    with {:ok, results} <- normalize_results(result, params) do
      {:ok,
       %Confirmation{
         data: %{
           "community_id" => community.id,
           "command_id" => command_id,
           "results" => results
         }
       }}
    end
  end

  @doc false
  def present_confirmation(%Confirmation{} = confirmation), do: present(confirmation)

  defp normalize_results(results, _params) when is_list(results), do: {:ok, results}

  defp normalize_results(_result, %{target_user_id: user_id}) do
    {:ok, [%{"user_id" => user_id, "ok" => true, "error" => nil}]}
  end

  defp present(%Confirmation{
         data: %{"community_id" => id, "command_id" => command_id, "results" => results}
       }) do
    case FrontDesk.community(id, mode: :internal) do
      {:ok, %Community{} = community} ->
        {:ok, %{community | command_id: command_id, moderator_results: results}}

      {:error, _reason} ->
        {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end
end
