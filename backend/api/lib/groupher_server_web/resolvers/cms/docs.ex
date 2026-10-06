defmodule GroupherServerWeb.Resolvers.CMS.Docs do
  @moduledoc """
  Adapts Docs tree, draft, version, and publish fields to CMS Docs use cases.

      GraphQL Docs field -> this resolver -> CMS.DocTree/Articles facade
  """

  alias GroupherServer.CMS
  alias GroupherServer.CMS.ErrorCat, as: CmsErrorCat
  alias GroupherServer.CMS.Model.Community

  def doc_tree(_root, %{community: %Community{} = community}, %{context: %{cur_user: user}}) do
    CMS.DocTree.read(community, actor: user, policy_mode: :moderator_management)
  end

  def doc_tree(_root, %{community: community}, %{context: %{cur_user: user}}) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.DocTree.read(community, actor: user, policy_mode: :moderator_management)
    end
  end

  def doc_public_tree(_root, %{community: %Community{} = community}, _info) do
    CMS.DocTree.read_public(community)
  end

  def doc_public_tree(_root, %{community: community}, _info) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.DocTree.read_public(community)
    end
  end

  def doc_tree_trash_items(
        _root,
        %{community: %Community{} = community},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocTree.trash_items(community, actor: user, policy_mode: :moderator_management)
  end

  def doc_tree_trash_items(
        _root,
        %{community: community},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.DocTree.trash_items(community, actor: user, policy_mode: :moderator_management)
    end
  end

  def doc_cover(
        _root,
        %{community: %Community{} = community} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.read(community, doc_cover_view(args), user)
  end

  def doc_cover(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: user}}
      ) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.DocCover.read(community, doc_cover_view(args), user)
    end
  end

  def doc_draft(
        _root,
        %{community: %Community{} = community, id: doc_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.Docs.read_editor_head(community, doc_id, actor: user, policy_mode: :moderator_management)
  end

  def doc_draft(
        _root,
        %{community: community, id: doc_id},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.Docs.read_editor_head(community, doc_id,
        actor: user,
        policy_mode: :moderator_management
      )
    end
  end

  def doc_branch_versions(_root, %{doc_id: doc_id, branch_id: branch_id} = args, _info) do
    with {:ok, branch_id} <- positive_integer_id(branch_id) do
      CMS.Docs.list_branch_versions(doc_id, branch_id, limit: Map.get(args, :limit, 30))
    end
  end

  def doc_branch_version(
        _root,
        %{doc_id: doc_id, branch_id: branch_id, branch_version_id: branch_version_id},
        _info
      ) do
    with {:ok, branch_id} <- positive_integer_id(branch_id),
         {:ok, branch_version_id} <- positive_integer_id(branch_version_id) do
      CMS.Docs.get_branch_version(doc_id, branch_id, branch_version_id)
    end
  end

  def restore_doc_revision_to_draft(
        _root,
        %{doc_id: doc_id, branch_id: branch_id, revision_id: revision_id, cur_user: user} = args,
        _info
      ) do
    with {:ok, branch_id} <- positive_integer_id(branch_id) do
      opts =
        case args[:expected_version] do
          version when is_integer(version) -> [expected_version: version]
          _ -> []
        end

      CMS.Docs.restore_revision_to_draft(doc_id, branch_id, revision_id, user, opts)
    end
  end

  def create_doc_tree_node(
        _root,
        %{community: community, input: input} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.DocTree.create_node(
      community,
      input
      |> Map.put(:parent_node_id, args[:parent_node_id])
      |> Map.put(:base_revision, args[:base_revision])
      |> Map.put(:command_id, args[:command_id]),
      user
    )
  end

  def update_doc_tree_node(
        _root,
        %{community: community, id: id, patch: patch} = args,
        _info
      ) do
    CMS.DocTree.update_node(
      community,
      id,
      patch
      |> Map.put(:base_revision, args[:base_revision])
      |> Map.put(:command_id, args[:command_id]),
      args.cur_user
    )
  end

  def update_doc_draft(
        _root,
        %{
          community: community,
          article: %CMS.Model.Article{} = doc,
          branch_id: branch_id,
          cur_user: user
        } = args,
        _info
      ) do
    CMS.DocTree.update_draft(
      community,
      doc,
      args
      |> Map.take([:title, :subtitle, :slug, :body_bag, :expected_version, :command_id])
      |> Map.put(:branch_id, branch_id),
      user
    )
  end

  def doc_publish_checklist(_root, %{community: community}, _info) do
    {:ok, CMS.DocTree.publish_checklist(community)}
  end

  def publish_doc_changes(
        _root,
        %{community: community, cur_user: user} = args,
        _info
      ) do
    input = Map.get(args, :input) || %{}
    sync_cover? = publish_with_cover_sync?(args)

    CMS.DocTree.publish_changes(community, input, user,
      sync_cover: sync_cover?,
      command_id: args[:command_id]
    )
  end

  def move_doc_to_draft(_root, %{community: community, id: id, cur_user: user} = args, _info) do
    CMS.DocTree.move_doc_to_draft_result(community, id, user, command_id: args[:command_id])
  end

  def move_doc_tree_subtree_to_draft(
        _root,
        %{community: community, node_id: node_id, cur_user: user} = args,
        _info
      ) do
    CMS.DocTree.move_subtree_to_draft(community, node_id, user, command_id: args[:command_id])
  end

  def add_doc_cover_card(
        _root,
        %{community: community, group_node_id: group_node_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.add_card(community, group_node_id, user)
  end

  def remove_doc_cover_card(
        _root,
        %{community: community, group_node_id: group_node_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.remove_card(community, group_node_id, user)
  end

  def reorder_doc_cover_cards(
        _root,
        %{community: community, ids: ids},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.reorder_cards(community, ids, user)
  end

  def update_doc_cover_card_appearance(
        _root,
        %{community: community, id: id, appearance: appearance},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.update_card_appearance(community, id, appearance, user)
  end

  def pin_doc_to_cover(
        _root,
        %{community: community, node_id: node_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.pin_doc(community, node_id, user)
  end

  def unpin_doc_from_cover(
        _root,
        %{community: community, node_id: node_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.unpin_doc(community, node_id, user)
  end

  def reorder_doc_cover_pinned_docs(
        _root,
        %{community: community, node_ids: node_ids},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.reorder_pinned_docs(community, node_ids, user)
  end

  def update_pinned_doc_appearance(
        _root,
        %{community: community, node_id: node_id, appearance: appearance},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.update_pinned_doc_appearance(community, node_id, appearance, user)
  end

  def delete_doc_tree_node(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.delete_node(
      community,
      id,
      %{base_revision: args[:base_revision], command_id: args[:command_id]},
      args.cur_user
    )
  end

  def restore_doc_tree_trash_item(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.restore_trash_item(
      community,
      id,
      %{
        base_revision: args[:base_revision],
        command_id: args[:command_id],
        target_parent_node_id: args[:target_parent_node_id],
        target_index: args[:target_index]
      },
      args.cur_user
    )
  end

  def duplicate_doc_tree_node(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.duplicate_node(
      community,
      id,
      %{base_revision: args[:base_revision], command_id: args[:command_id]},
      args.cur_user
    )
  end

  def move_doc_tree_node(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.move_node(
      community,
      id,
      %{
        base_revision: args[:base_revision],
        command_id: args[:command_id],
        target_parent_node_id: args[:target_parent_node_id],
        target_index: args.target_index
      },
      args.cur_user
    )
  end

  defp doc_cover_view(args) do
    Map.get(args, :view) || :public
  end

  defp positive_integer_id(value) when is_integer(value) and value > 0 do
    {:ok, value}
  end

  defp positive_integer_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {id, ""} when id > 0 -> {:ok, id}
      _ -> {:error, CmsErrorCat.custom("invalid id")}
    end
  end

  defp positive_integer_id(_value) do
    {:error, CmsErrorCat.custom("invalid id")}
  end

  defp publish_with_cover_sync?(args) do
    (Map.get(args, :mode) || :with_cover_sync) == :with_cover_sync
  end
end
