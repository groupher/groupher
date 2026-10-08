defmodule GroupherServer.CMS.Communities.Commands.Update do
  @moduledoc """
  Updates Community fields under the canonical Gate transaction.

      Communities facade
        -> Commands.Update.execute
        -> CMS.Gate community lock
        -> Communities.Persist
        -> presentation Outbox intent
  """

  alias GroupherServer.CMS
  alias CMS.Communities.Persist
  alias CMS.Dashboard.Effects
  alias CMS.Model.Community
  alias Helper.T

  @doc """
  Updates one Community as an authenticated domain command.

  ## Examples

      execute(...)
      #=> {:ok, value}
  """
  @spec execute(Community.t(), map(), term(), Ecto.UUID.t()) :: T.domain_res(Community.t())
  def execute(%Community{} = community, args, actor, command_id) do
    CMS.Gate.with_community_check(actor, :update, community, fn canonical ->
      with {:ok, canonical} <- Persist.update_fields(canonical, args),
           {:ok, _event} <-
             Effects.enqueue_presentation_changed(canonical, command_id) do
        {:ok, canonical}
      end
    end)
  end
end
