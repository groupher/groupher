defmodule GroupherServer.CMS.DocCover.Commands.Support do
  @moduledoc """
  Shared admission boundary for DocCover commands.

      GraphQL command
        -> concrete DocCover command
        -> CMS.Gate Community lock
        -> DocCover.Persist
  """

  alias GroupherServer.CMS
  alias CMS.DocCover.Commands.{ConfirmationSupport, DocCoverConfirmation}
  alias CMS.Model.Community

  @doc """
  Runs one DocCover persistence callback after the Community Gate admits it.

  ## Examples

      Support.run(actor, :manage_docs, community, fn canonical -> {:ok, canonical} end)
      #=> {:ok, community}
  """
  @spec run(term(), atom(), Community.t(), (Community.t() -> term())) :: term()
  def run(actor, action, %Community{} = community, callback) when is_function(callback, 1) do
    CMS.Gate.with_community_check(actor, action, community, callback)
  end

  @doc """
  Executes one receipt-backed DocCover action inside the canonical Command flow.

  ## Examples

      Support.execute_receipted(community, actor, command_id, :doc_cover_pin_doc, %{node_id: id}, fn canonical ->
        Persist.pin_doc(canonical, id)
      end)
      #=> {:ok, result} | {:error, reason}
  """
  @spec execute_receipted(
          Community.t(),
          term(),
          Ecto.UUID.t(),
          atom(),
          map(),
          (Community.t() -> term())
        ) :: term()
  def execute_receipted(
        %Community{} = community,
        actor,
        command_id,
        operation,
        params,
        callback
      )
      when is_atom(operation) and is_map(params) and is_function(callback, 1) do
    %CMS.Command{
      actor: actor,
      command_id: command_id,
      operation: operation,
      target: community,
      params: params
    }
    |> CMS.Command.execute(
      action: fn %{target: canonical, actor: actor} ->
        CMS.Gate.with_community_check(actor, :manage_docs, canonical, fn locked ->
          with {:ok, result} <- callback.(locked) do
            {:ok, ConfirmationSupport.confirmation(result, command_id)}
          end
        end)
      end,
      confirmation: DocCoverConfirmation
    )
    |> ConfirmationSupport.present()
  end
end
