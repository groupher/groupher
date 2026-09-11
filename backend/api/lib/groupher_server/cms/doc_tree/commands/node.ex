defmodule GroupherServer.CMS.DocTree.Commands.Node do
  @moduledoc """
  Runs existing receipt-backed commands for Docs tree nodes and page Drafts.

  The named `create_tab/group/link/pin` facade entries are intentionally not
  handled here because they do not currently participate in CommandReceipt.

  Business position:

      CMS.DocTree facade
        -> Commands.Node
        -> CommandReceipt / CommandReplay
        -> DocTree.Writer
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.DocTree.{CommandReplay, Reader, Writer}
  alias CMS.CommandReceipt
  alias CMS.Model.{Community, Doc}
  alias Helper.T

  @doc "Creates one typed tree node through the existing command protocol."
  @spec create_node(Community.t(), map(), User.t() | nil) :: T.domain_res(map())
  def create_node(%Community{} = community, %{type: type} = args, user) do
    run_tree_command(
      community,
      Map.get(args, :parent_node_id, "root"),
      args,
      user,
      "doc.tree.create_#{type}",
      fn clean_args ->
        case type do
          :tab -> Writer.create_tab(community, clean_args)
          :group -> Writer.create_group(community, clean_args)
          :page -> Writer.create_page(community, clean_args, user)
          :link -> Writer.create_link(community, clean_args)
          :pin -> Writer.create_pin(community, clean_args)
          _ -> {:error, GroupherServer.ErrorCat.custom("unsupported docs tree node type")}
        end
      end
    )
  end

  @doc "Creates a page node and its Draft through the existing command protocol."
  @spec create_page(Community.t(), map(), User.t() | nil) :: T.domain_res(map())
  def create_page(%Community{} = community, args, user) do
    run_tree_command(
      community,
      Map.get(args, :parent_node_id, "root"),
      args,
      user,
      "doc.tree.create_page",
      fn clean_args -> Writer.create_page(community, clean_args, user) end
    )
  end

  @doc "Updates mutable tree-node metadata through the command protocol."
  @spec update_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def update_node(%Community{} = community, id, args) do
    run_tree_command(
      community,
      id,
      args,
      option(args, :actor),
      "doc.tree.update_node",
      fn clean_args -> Writer.update_node(community, id, clean_args) end
    )
  end

  @doc "Updates the Draft content associated with a Docs page."
  @spec update_draft(Community.t(), Doc.t(), map(), User.t()) :: T.domain_res(map())
  def update_draft(%Community{} = community, %Doc{} = doc, args, %User{} = user) do
    # The resolved Doc owns the branch coordinate; an external branch option
    # must not redirect this resource mutation to another branch.
    args = Map.put(args, :branch_id, doc.branch_id)
    update_draft(community, doc.article_hash_id, args, user)
  end

  @spec update_draft(Community.t(), T.id(), map(), User.t()) :: T.domain_res(map())
  def update_draft(%Community{} = community, id, args, %User{} = user) do
    run_doc_command(
      community,
      id,
      user,
      "doc.update_draft",
      args,
      fn -> Writer.update_draft(community, id, drop_command_key(args), user) end,
      fn _receipt -> Reader.read_draft(community, id, args) end
    )
  end

  @doc "Deletes a tree node and records recoverable snapshots."
  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def delete_node(%Community{} = community, id, args) do
    run_tree_command(
      community,
      id,
      args,
      option(args, :actor),
      "doc.tree.delete_node",
      fn clean_args -> Writer.delete_node(community, id, clean_args) end
    )
  end

  @doc "Duplicates a mutable tree subtree through the command protocol."
  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def duplicate_node(%Community{} = community, id, args) do
    run_tree_command(
      community,
      id,
      args,
      option(args, :actor),
      "doc.tree.duplicate_node",
      fn clean_args -> Writer.duplicate_node(community, id, clean_args) end
    )
  end

  @doc "Moves a mutable tree node through the command protocol."
  @spec move_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def move_node(%Community{} = community, id, args) do
    run_tree_command(
      community,
      id,
      args,
      option(args, :actor),
      "doc.tree.move_node",
      fn clean_args -> Writer.move_node(community, id, clean_args) end
    )
  end

  defp run_doc_command(community, id, user, command_name, opts, execute, replay) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts) do
      opts = drop_command_key(opts)

      CommandReceipt.run_user_command(
        user,
        command_key,
        command_name,
        "doc",
        "#{community.id}:#{id}",
        opts,
        execute,
        replay
      )
    end
  end

  defp run_tree_command(community, target_id, args, user, command_name, execute) do
    clean_args = drop_command_key(args)

    case user do
      %User{} = actor ->
        with {:ok, command_key} <- CommandReceipt.resolve_command_key(args) do
          target_key = "#{community.id}:#{target_id}"

          CommandReceipt.run_user_command(
            actor,
            command_key,
            command_name,
            "doc_tree",
            target_key,
            clean_args,
            fn ->
              with {:ok, result} <- execute.(clean_args) do
                {:ok, result, CommandReplay.tree_metadata(result, target_key)}
              end
            end,
            &CommandReplay.replay_tree/1
          )
        end

      _ ->
        execute.(clean_args)
    end
  end

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil

  defp drop_command_key(opts) when is_map(opts), do: Map.delete(opts, :command_key)
  defp drop_command_key(opts) when is_list(opts), do: Keyword.delete(opts, :command_key)
  defp drop_command_key(opts), do: opts
end
