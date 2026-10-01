defmodule GroupherServer.CMS.DocTree.Commands.Node do
  @moduledoc """
  Runs existing receipt-backed commands for Docs tree nodes and page Drafts.

  The named `create_tab/group/link/pin` facade entries are intentionally not
  handled here because they do not currently participate in CommandReceipt.

  Business position:

      CMS.DocTree facade
        -> Commands.Node
        -> CMS.Command / CommandReplay
        -> DocTree.Writer
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.{Command, ErrorCat}
  alias CMS.DocTree.{CommandReplay, Writer}
  alias CMS.Model.{Article, Community}
  alias Helper.T

  @doc "Creates one typed tree node through the existing command protocol."
  @spec create_node(Community.t(), map(), User.t() | nil) :: T.domain_res(map())
  def create_node(%Community{} = community, %{type: type} = args, user) do
    with {:ok, command} <- node_create_command(type) do
      run_tree_command(
        community,
        Map.get(args, :parent_node_id, "root"),
        args,
        user,
        command,
        fn clean_args -> create_node_by_type(type, community, clean_args, user) end
      )
    end
  end

  # Keep node-type dispatch close to the command boundary; each clause makes
  # the writer ownership explicit without hiding it in a generic lookup map.
  defp create_node_by_type(:tab, community, args, _user), do: Writer.create_tab(community, args)

  defp create_node_by_type(:group, community, args, _user),
    do: Writer.create_group(community, args)

  defp create_node_by_type(:page, community, args, user),
    do: Writer.create_page(community, args, user)

  defp create_node_by_type(:link, community, args, _user), do: Writer.create_link(community, args)
  defp create_node_by_type(:pin, community, args, _user), do: Writer.create_pin(community, args)

  defp node_create_command(:tab), do: {:ok, :doc_tree_create_tab}
  defp node_create_command(:group), do: {:ok, :doc_tree_create_group}
  defp node_create_command(:page), do: {:ok, :doc_tree_create_page}
  defp node_create_command(:link), do: {:ok, :doc_tree_create_link}
  defp node_create_command(:pin), do: {:ok, :doc_tree_create_pin}

  defp node_create_command(_type),
    do: {:error, ErrorCat.custom("unsupported docs tree node type")}

  @doc "Creates a page node and its Draft through the existing command protocol."
  @spec create_page(Community.t(), map(), User.t() | nil) :: T.domain_res(map())
  def create_page(%Community{} = community, args, user) do
    run_tree_command(
      community,
      Map.get(args, :parent_node_id, "root"),
      args,
      user,
      :doc_tree_create_page,
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
      :doc_tree_update_node,
      fn clean_args -> Writer.update_node(community, id, clean_args) end
    )
  end

  @doc "Updates the Draft content associated with a Docs page."
  @spec update_draft(Community.t(), Article.t(), map(), User.t()) :: T.domain_res(map())
  def update_draft(
        %Community{} = community,
        %Article{thread: :doc} = article,
        args,
        %User{} = user
      ) do
    update_draft(community, article.id, args, user)
  end

  @spec update_draft(Community.t(), T.id(), map(), User.t()) :: T.domain_res(map())
  def update_draft(%Community{} = community, id, args, %User{} = user) do
    run_doc_command(
      community,
      id,
      user,
      :doc_update_draft,
      args,
      fn -> Writer.update_draft(community, id, drop_command_id(args), user) end,
      fn _receipt -> CMS.Docs.read_editor_head(community, id, args) end
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
      :doc_tree_delete_node,
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
      :doc_tree_duplicate_node,
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
      :doc_tree_move_node,
      fn clean_args -> Writer.move_node(community, id, clean_args) end
    )
  end

  defp run_doc_command(community, id, user, command, opts, execute, replay) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      opts = drop_command_id(opts)

      Command.create_user(user, command_id,
        command: command,
        resource: :doc,
        owner: community,
        input: %{id: id, opts: opts},
        recovery: replay
      )
      |> Command.run(fn %{input: %{opts: _opts}} -> execute.() end)
    end
  end

  defp run_tree_command(community, target_id, args, user, command, execute) do
    clean_args = drop_command_id(args)

    case user do
      %User{} = actor ->
        with {:ok, command_id} <- Command.resolve_command_id(option(args, :command_id)) do
          target_key = "#{community.id}:#{target_id}"

          Command.create_user(actor, command_id,
            command: command,
            resource: :doc_tree,
            owner: community,
            input: %{target_id: target_id, args: clean_args},
            recovery: &CommandReplay.replay_tree/1
          )
          |> Command.run(fn %{input: %{args: clean_args}} ->
            with {:ok, result} <- execute.(clean_args) do
              {:ok, result, CommandReplay.tree_metadata(result, target_key)}
            end
          end)
        end

      _ ->
        execute.(clean_args)
    end
  end

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil

  defp drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  defp drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  defp drop_command_id(opts), do: opts
end
