defmodule GroupherServer.CMS.Communities.Subscriptions.Commands.Support do
  @moduledoc """
  Shared target loading, receipt and canonical result helpers.

      Command -> Support target/confirmation -> Receipt recovery -> Query result
  """

  alias GroupherServer.CMS
  alias CMS.Communities.ErrorCat
  alias CMS.FrontDesk
  alias CMS.Model.Community

  @doc "Accepts an already-loaded Community or resolves a reference internally."
  def community(%Community{} = community), do: {:ok, community}
  def community(ref), do: FrontDesk.community(ref, mode: :internal)

  @doc "Builds a subscription command confirmation for a Community and command ID."
  def confirmation(module, community_id, command_id) do
    struct(module, data: %{"community_id" => community_id, "command_id" => command_id})
  end

  @doc "Reloads the Community identified by a stored command confirmation."
  def community_result(%{data: %{"community_id" => id}}) do
    case FrontDesk.community(id, mode: :internal) do
      {:ok, %Community{} = community} -> {:ok, community}
      {:error, _reason} -> {:error, ErrorCat.not_exist("Community")}
    end
  end

  def community_result(_), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
