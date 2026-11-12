defmodule GroupherServer.Test.CMS.DocTree.CommandBoundary do
  use ExUnit.Case, async: true
  alias GroupherServer.{CMS, Accounts}
  alias Accounts.Model.User
  alias CMS.DocTree.Commands.{BeginEdit, CreateWorkspaceNode, PurgeWorkspaceTrash, ReleaseQueue}

  test "workspace writes require an explicit authenticated command identity" do
    community = %CMS.Model.Community{id: 1}
    actor = %User{id: 1}

    assert {:error, :invalid_tree_input} =
             CreateWorkspaceNode.execute(community, 0, %{}, actor, nil)

    assert {:error, :invalid_doc_identity} =
             BeginEdit.execute(community, Ecto.UUID.generate(), nil, actor, nil)

    assert {:error, :invalid_docs_publish} = ReleaseQueue.execute(community, 0, actor, nil)

    assert {:error, :invalid_tree_input} =
             PurgeWorkspaceTrash.execute(community, 0, Ecto.UUID.generate(), actor, nil)

    assert {:error, :invalid_docs_publish} =
             ReleaseQueue.execute(community, 0, nil, Ecto.UUID.generate())
  end
end
