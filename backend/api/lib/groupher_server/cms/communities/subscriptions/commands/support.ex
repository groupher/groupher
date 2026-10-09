defmodule GroupherServer.CMS.Communities.Subscriptions.Commands.Support do
  @moduledoc """
  Shared target loading, receipt and canonical result helpers.

      Command -> Support target/confirmation -> Receipt recovery -> Query result
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Communities.ErrorCat
  alias CMS.FrontDesk
  alias CMS.Model.{Community}

  def community(%Community{} = community), do: {:ok, community}
  def community(ref), do: FrontDesk.community(ref, mode: :internal)

  def confirmation(module, community_id, command_id),
    do: struct(module, data: %{"community_id" => community_id, "command_id" => command_id})

  def community_result(%{data: %{"community_id" => id}}) do
    case Repo.get(Community, id) do
      %Community{slug: slug} -> FrontDesk.community(slug, mode: :internal)
      nil -> {:error, ErrorCat.not_exist("Community")}
    end
  end

  def community_result(_), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
