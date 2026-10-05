defmodule GroupherServer.CMS.DocTree.Commands.CreateNode do
  @moduledoc """
  Dispatches one declared node type to its concrete business-action command.

      CMS.DocTree.create_node
        -> CreateNode.execute
        -> CreateTab / CreateGroup / CreatePage / CreateLink / CreatePin
  """

  alias GroupherServer.CMS.ErrorCat
  alias GroupherServer.CMS.DocTree.Commands

  def execute(community, %{type: :tab} = args, user) do
    Commands.CreateTab.execute(community, args, user)
  end

  def execute(community, %{type: :group} = args, user) do
    Commands.CreateGroup.execute(community, args, user)
  end

  def execute(community, %{type: :page} = args, user) do
    Commands.CreatePage.execute(community, args, user)
  end

  def execute(community, %{type: :link} = args, user) do
    Commands.CreateLink.execute(community, args, user)
  end

  def execute(community, %{type: :pin} = args, user) do
    Commands.CreatePin.execute(community, args, user)
  end

  def execute(_community, _args, _user) do
    {:error, ErrorCat.custom("unsupported docs tree node type")}
  end
end
