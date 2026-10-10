defmodule GroupherServer.CMS.Communities.Commands.RequestDestroy do
  @moduledoc """
  Requests reversible Community destruction through the command receipt boundary.

      CMS.Communities.request_destroy/3
        -> RequestDestroy.execute/3
        -> CMS.Command
        -> Gate / Lifecycle / Confirmation
  """

  alias GroupherServer.CMS
  alias CMS.{Command, FrontDesk, Gate}
  alias CMS.Communities.{ErrorCat, Lifecycle, RequestDestroyConfirmation}
  alias CMS.Model.{Community}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), User.t(), keyword()) :: T.domain_res(Community.t())
  def execute(%Community{} = community, %User{} = actor, opts) do
    command = %Command{
      actor: actor,
      command_id: Keyword.get(opts, :command_id),
      operation: :community_request_destroy,
      target: community,
      params: opts |> Keyword.delete(:command_id) |> Map.new()
    }

    with {:ok, confirmation} <-
           Command.execute(command,
             action: &request_destroy_action/1,
             confirmation: RequestDestroyConfirmation
           ) do
      FrontDesk.community(confirmation.data["community_slug"], mode: :internal)
    end
  end

  def execute(_community, _actor, _opts), do: {:error, ErrorCat.not_exist("Community")}

  defp request_destroy_action(%{
         actor: actor,
         target: community,
         params: opts,
         command_id: command_id
       }) do
    opts = Map.to_list(opts)

    with {:ok, canonical} <- Gate.access_check(actor, :request_destroy, community),
         {:ok, _blocker} <-
           Lifecycle.request_destroy(
             canonical.id,
             Keyword.put(opts, :operation_ref, command_id)
           ) do
      {:ok,
       %RequestDestroyConfirmation{
         data: %{
           "community_id" => to_string(canonical.id),
           "community_slug" => canonical.slug,
           "operation_ref" => command_id
         }
       }}
    end
  end
end
