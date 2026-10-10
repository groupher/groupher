defmodule GroupherServer.CMS.Press.Commands.UpdateConfig do
  @moduledoc """
  Updates one Community's Press configuration through the Receipt boundary.

      commandId -> UpdateConfig -> Receipt -> Gate -> ConfigWriter -> Activity
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.Command.ConfirmationDefinition
  alias CMS.Model.{Community, PressConfig}
  alias CMS.Press.{ConfigWriter, Query}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  defmodule Confirmation do
    @moduledoc """
    Recovers the stable Press config community and revision after a lost response.

        Press config mutation -> Confirmation -> Press.Query.config
    """

    use ConfirmationDefinition,
      operation: :press_config_update,
      data_keys: ["community", "revision", "command_id"],
      field_types: %{
        "community" => :string,
        "revision" => :integer,
        "command_id" => :string
      }
  end

  @spec execute(Community.t() | String.t(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(PressConfig.t() | map())
  def execute(community_ref, attrs, %User{} = actor, command_id) do
    with {:ok, community} <- Query.internal_community(community_ref) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :press_config_update,
        target: community,
        params: attrs
      }

      with {:ok, confirmation} <-
             Command.execute(command, action: &action/1, confirmation: Confirmation) do
        present(confirmation)
      end
    end
  end

  defp action(%{
         actor: actor,
         target: %Community{} = community,
         params: attrs,
         command_id: command_id
       }) do
    with {:ok, config} <-
           Gate.with_community_check(actor, :update, community, fn canonical ->
             ConfigWriter.update(canonical, attrs, actor, command_id)
           end),
         %PressConfig{revision: revision} <- config do
      {:ok,
       %Confirmation{
         data: %{
           "community" => community.slug,
           "revision" => revision,
           "command_id" => command_id
         }
       }}
    end
  end

  defp present(%Confirmation{data: %{"community" => community}}),
    do: Query.config(community)

  defp present(_confirmation), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
