defmodule GroupherServerWeb.Resolvers.CMS.Docs do
  @moduledoc """
  Adapts Docs tree, draft, version, and publish fields to CMS Docs use cases.

      GraphQL Docs field -> this resolver -> CMS.DocTree/Articles facade
  """

  alias GroupherServer.CMS

  alias CMS.Model.Community

  @doc "Approves the specified queue revision, mapping stale revisions and disallowed approvals to Docs errors."
  def approve_docs_queue(
        _root,
        %{
          community: community,
          queue_revision: revision,
          command_id: command_id,
          cur_user: actor
        },
        _info
      ) do
    case CMS.docs_approve_queue(community, revision, actor, command_id) do
      {:error, {:queue_version_conflict, _, _}} -> {:error, CMS.docs_state_conflict()}
      {:error, :docs_approval_not_allowed} -> {:error, CMS.docs_approval_not_allowed()}
      {:error, :docs_self_approval_forbidden} -> {:error, CMS.docs_self_approval_forbidden()}
      result -> result
    end
  end

  @doc "Reads a Doc editor source without creating a default copy."
  def docs_editor(_root, %{community: community, article_id: id}, %{context: %{cur_user: actor}}) do
    CMS.docs_editor_read(community, id, actor)
  end

  @doc "Explicitly initializes a default copy from the selected public Snapshot."
  def begin_docs_edit(
        _root,
        %{
          community: community,
          article_id: id,
          public_snapshot_id: snapshot,
          cur_user: actor,
          command_id: command_id
        },
        _info
      ) do
    case CMS.docs_begin_edit(community, id, snapshot, actor, command_id) do
      {:error, :public_conflict} -> {:error, CMS.docs_state_conflict()}
      result -> result
    end
  end

  @doc "Reads the post-publication conflict for a document in the actor's community workspace."
  def docs_post_publish_conflict(_root, %{community: community, article_id: article_id}, %{
        context: %{cur_user: actor}
      }) do
    CMS.docs_post_publish_conflict(community, article_id, actor)
  end

  @doc "Applies one choice per field; unresolved fields are returned as data, stale revisions as errors."
  def resolve_docs_post_publish(
        _root,
        %{
          community: community,
          article_id: article_id,
          working_copy_id: working_copy_id,
          default_revision: default_revision,
          public_snapshot_id: snapshot_id,
          choices: choices,
          command_id: command_id,
          cur_user: actor
        },
        _info
      ) do
    selected = Map.new(choices, &{&1.field, &1.side})

    if map_size(selected) != length(choices) do
      {:error, CMS.docs_invalid_merge_choice()}
    else
      case CMS.docs_resolve_post_publish(
             community,
             article_id,
             working_copy_id,
             default_revision,
             snapshot_id,
             selected,
             actor,
             command_id
           ) do
        {:error, {:merge_conflict, fields}} -> {:ok, %{conflict_fields: fields}}
        {:error, {:default_revision_conflict, _, _}} -> {:error, CMS.docs_state_conflict()}
        {:error, :public_conflict} -> {:error, CMS.docs_state_conflict()}
        {:error, :doc_conflict_or_owner_not_found} -> {:error, CMS.docs_state_conflict()}
        {:error, :invalid_doc_default_owner} -> {:error, CMS.docs_state_conflict()}
        {:error, :invalid_conflict_choice} -> {:error, CMS.docs_invalid_merge_choice()}
        result -> result
      end
    end
  end

  @doc "Saves edits to a queued document, reporting a state conflict if the queue or copy revision is stale."
  def save_docs_queue_copy(
        _root,
        %{
          community: community,
          article_id: article_id,
          queue_revision: queue_revision,
          working_copy_revision: work_revision,
          command_id: command_id,
          cur_user: actor
        } = args,
        _info
      ) do
    attrs =
      Map.drop(args, [
        :community,
        :article_id,
        :queue_revision,
        :working_copy_revision,
        :command_id,
        :cur_user
      ])

    case CMS.docs_queue_save(
           community,
           queue_revision,
           article_id,
           work_revision,
           attrs,
           actor,
           command_id
         ) do
      {:error, {:queue_version_conflict, _, _}} ->
        {:error, CMS.docs_queue_version_conflict()}

      {:error, {:queue_work_revision_conflict, _, _}} ->
        {:error, CMS.docs_queue_copy_revision_conflict()}

      result ->
        result
    end
  end

  @doc "Merges a queued copy using distinct field choices; unresolved conflicts are returned in the payload."
  def merge_docs_queue_copy(
        _root,
        %{
          community: community,
          queue_revision: queue_revision,
          article_id: article_id,
          default_revision: default_revision,
          working_copy_revision: work_revision,
          choices: choices,
          command_id: command_id,
          cur_user: actor
        },
        _info
      ) do
    selected = Map.new(choices, &{&1.field, &1.side})

    if map_size(selected) != length(choices) do
      {:error, CMS.docs_invalid_merge_choice()}
    else
      case CMS.docs_queue_merge(
             community,
             queue_revision,
             article_id,
             default_revision,
             work_revision,
             selected,
             actor,
             command_id
           ) do
        {:error, {:merge_conflict, conflict}} ->
          {:ok, %{conflict: conflict}}

        {:error, {:queue_version_conflict, _, _}} ->
          {:error, CMS.docs_state_conflict()}

        {:error, {:default_revision_conflict, _, _}} ->
          {:error, CMS.docs_state_conflict()}

        {:error, {:queue_work_revision_conflict, _, _}} ->
          {:error, CMS.docs_state_conflict()}

        {:error, :invalid_conflict_choice} ->
          {:error, CMS.docs_invalid_merge_choice()}

        result ->
          result
      end
    end
  end

  @doc "Reads the public document tree, resolving a community reference without counting a view."
  def doc_public_tree(_root, %{community: %Community{} = community}, _info) do
    CMS.doc_tree_read_public(community)
  end

  def doc_public_tree(_root, %{community: community}, _info) do
    with {:ok, community} <- CMS.fetch_community(community, inc_views: false) do
      CMS.doc_tree_read_public(community)
    end
  end

  def doc_cover(
        _root,
        %{community: %Community{} = community} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.doc_cover_read(community, doc_cover_view(args), user)
  end

  def doc_cover(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: user}}
      ) do
    with {:ok, community} <- CMS.fetch_community(community, inc_views: false) do
      CMS.doc_cover_read(community, doc_cover_view(args), user)
    end
  end

  @doc "Reads the community's document publication queue on behalf of the signed-in actor."
  def docs_publish_queue(_root, %{community: community}, %{context: %{cur_user: actor}}) do
    CMS.docs_publish_queue(community, actor)
  end

  @doc "Reads the editable document tree for the community and signed-in actor."
  def docs_queue_member(_root, %{community: community, article_id: article_id}, %{
        context: %{cur_user: actor}
      }) do
    CMS.docs_queue_member_read(community, article_id, actor)
  end

  def docs_workspace_tree(_root, %{community: community}, %{context: %{cur_user: actor}}) do
    CMS.docs_workspace_read(community, actor)
  end

  @doc "Previews removal of the selected articles from a specific queue revision."
  def docs_dequeue_preview(
        _root,
        %{community: community, queue_revision: revision, article_ids: ids},
        %{context: %{cur_user: actor}}
      ) do
    CMS.docs_dequeue_preview(community, revision, ids, actor)
  end

  @doc "Previews deletion of a workspace node against the supplied tree and queue revisions."
  def docs_workspace_delete_preview(
        _root,
        %{
          community: community,
          tree_revision: tree_revision,
          queue_revision: queue_revision,
          node_id: node_id
        },
        %{context: %{cur_user: actor}}
      ) do
    CMS.docs_delete_preview(
      community,
      tree_revision,
      queue_revision,
      node_id,
      actor
    )
    |> workspace_result()
  end

  @doc "Purges workspace trash by trash action ID at the supplied queue revision."
  def purge_docs_workspace_trash(
        _root,
        %{
          community: community,
          queue_revision: queue_revision,
          trash_action_id: action_id,
          command_id: command_id,
          cur_user: actor
        },
        _info
      ) do
    CMS.docs_trash_purge(
      community,
      queue_revision,
      action_id,
      actor,
      command_id
    )
    |> workspace_result()
  end

  @doc "Restores a trashed node, optionally specifying a target parent and position."
  def restore_docs_workspace_node(
        _root,
        %{
          community: community,
          tree_revision: tree_revision,
          queue_revision: queue_revision,
          trash_action_id: action_id,
          record_revision: record_revision,
          command_id: command_id,
          cur_user: actor
        } = args,
        _info
      ) do
    with {:ok, target_parent, target_index} <- restore_target_fields(args) do
      CMS.docs_workspace_restore(
        community,
        tree_revision,
        queue_revision,
        action_id,
        record_revision,
        target_parent,
        target_index,
        actor,
        command_id
      )
      |> workspace_result()
    end
  end

  @doc false
  def restore_target_fields(args) when is_map(args) do
    parent_provided? = Map.has_key?(args, :target_parent_node_id)
    index_provided? = Map.has_key?(args, :target_index)

    cond do
      not parent_provided? and index_provided? ->
        {:error, :invalid_tree_input}

      not parent_provided? ->
        {:ok, :restore_original, nil}

      true ->
        {:ok, Map.fetch!(args, :target_parent_node_id), Map.get(args, :target_index)}
    end
  end

  @doc "Deletes a workspace node at the supplied tree and queue revisions, forwarding discard confirmation when present."
  def delete_docs_workspace_node(
        _root,
        %{
          community: community,
          tree_revision: tree_revision,
          queue_revision: queue_revision,
          node_id: node_id,
          command_id: command_id,
          cur_user: actor
        } = args,
        _info
      ) do
    confirmation =
      case Map.get(args, :confirmation) do
        nil -> nil
        value -> %{"format_version" => value.format_version, "hash" => value.hash}
      end

    CMS.docs_workspace_delete(
      community,
      tree_revision,
      queue_revision,
      node_id,
      confirmation,
      actor,
      command_id
    )
    |> workspace_result()
  end

  defp workspace_result({:error, {:queue_version_conflict, _, _}}) do
    {:error, CMS.docs_state_conflict()}
  end

  defp workspace_result({:error, {:discard_confirmation_required, _}}) do
    {:error, CMS.docs_discard_confirmation_required()}
  end

  defp workspace_result({:error, :stale_discard_confirmation}) do
    {:error, CMS.docs_discard_confirmation_stale()}
  end

  defp workspace_result({:error, :restore_node_conflict}) do
    {:error, CMS.docs_restore_node_conflict()}
  end

  defp workspace_result({:error, :docs_delete_diverged_tree}) do
    {:error, CMS.docs_delete_diverged_tree()}
  end

  defp workspace_result({:error, :docs_trash_in_use}) do
    {:error, CMS.docs_trash_in_use()}
  end

  defp workspace_result(result), do: result

  @doc "Removes selected articles from the specified queue revision with optional discard confirmation."
  def dequeue_docs(
        _root,
        %{
          community: community,
          queue_revision: revision,
          article_ids: ids,
          command_id: command_id,
          cur_user: actor
        } = args,
        _info
      ) do
    confirmation =
      case Map.get(args, :confirmation) do
        nil -> nil
        value -> %{"format_version" => value.format_version, "hash" => value.hash}
      end

    CMS.docs_dequeue(
      community,
      revision,
      ids,
      confirmation,
      actor,
      command_id
    )
  end

  @doc "Moves a workspace node to the requested parent and position at the supplied tree revision."
  def move_docs_workspace_node(
        _root,
        %{
          community: community,
          tree_revision: revision,
          node_id: node_id,
          position: position,
          command_id: command_id,
          cur_user: actor
        } = args,
        _info
      ) do
    CMS.docs_workspace_move(
      community,
      revision,
      node_id,
      Map.get(args, :parent_node_id),
      position,
      actor,
      command_id
    )
  end

  @doc "Applies a patch to one workspace node at the supplied tree revision."
  def update_docs_workspace_node(
        _root,
        %{
          community: community,
          tree_revision: revision,
          node_id: node_id,
          patch: patch,
          command_id: command_id,
          cur_user: actor
        },
        _info
      ) do
    CMS.docs_workspace_update(
      community,
      revision,
      node_id,
      patch,
      actor,
      command_id
    )
  end

  @doc "Duplicates a workspace node at the supplied tree revision for the actor."
  def duplicate_docs_workspace_node(
        _root,
        %{
          community: community,
          tree_revision: revision,
          node_id: node_id,
          cur_user: actor,
          command_id: command_id
        },
        _info
      ) do
    CMS.docs_workspace_duplicate(community, revision, node_id, actor, command_id)
  end

  @doc "Creates a workspace node with the requested parent at the supplied tree revision."
  def create_docs_workspace_node(
        _root,
        %{
          community: community,
          tree_revision: revision,
          input: input,
          command_id: command_id,
          cur_user: actor
        } = args,
        _info
      ) do
    attrs = Map.put(input, :parent_node_id, Map.get(args, :parent_node_id))

    CMS.docs_workspace_create(
      community,
      revision,
      attrs,
      actor,
      command_id
    )
  end

  @doc "Adds the supplied entries to the document publication queue at the expected revision."
  def enqueue_docs(
        _root,
        %{
          community: community,
          queue_revision: revision,
          entries: entries,
          command_id: command_id,
          cur_user: actor
        },
        _info
      ) do
    CMS.docs_enqueue(community, revision, entries, actor, command_id)
  end

  @doc "Releases the specified queue revision, distinguishing missing approval from a stale queue."
  def release_docs_queue(
        _root,
        %{
          community: community,
          queue_revision: revision,
          command_id: command_id,
          cur_user: actor
        },
        _info
      ) do
    case CMS.docs_release_queue(community, revision, actor, command_id) do
      {:error, :docs_approval_required} -> {:error, CMS.docs_approval_required()}
      {:error, {:queue_version_conflict, _, _}} -> {:error, CMS.docs_state_conflict()}
      result -> result
    end
  end

  @doc "Adds the specified document group as a card on the community's document cover."
  def add_doc_cover_card(
        _root,
        %{community: community, group_node_id: group_node_id, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.doc_cover_add_card(community, group_node_id, user, command_id)
  end

  @doc "Removes the specified group's card from the document cover."
  def remove_doc_cover_card(
        _root,
        %{community: community, group_node_id: group_node_id, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.doc_cover_remove_card(community, group_node_id, user, command_id)
  end

  @doc "Sets the order of document cover cards from the supplied ID list."
  def reorder_doc_cover_cards(
        _root,
        %{community: community, ids: ids, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.doc_cover_reorder_cards(community, ids, user, command_id)
  end

  @doc "Updates the appearance of one document cover card by ID."
  def update_doc_cover_card_appearance(
        _root,
        %{community: community, id: id, appearance: appearance, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.doc_cover_update_card_appearance(community, id, appearance, user, command_id)
  end

  @doc "Pins a document node to the community's document cover."
  def pin_doc_to_cover(
        _root,
        %{community: community, node_id: node_id, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.doc_cover_pin_doc(community, node_id, user, command_id)
  end

  @doc "Removes a document node from the cover's pinned list."
  def unpin_doc_from_cover(
        _root,
        %{community: community, node_id: node_id, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.doc_cover_unpin_doc(community, node_id, user, command_id)
  end

  @doc "Sets the order of pinned cover documents from the supplied node IDs."
  def reorder_doc_cover_pinned_docs(
        _root,
        %{community: community, node_ids: node_ids, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.doc_cover_reorder_pinned_docs(community, node_ids, user, command_id)
  end

  @doc "Changes the cover appearance of one pinned document node."
  def update_pinned_doc_appearance(
        _root,
        %{community: community, node_id: node_id, appearance: appearance, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.doc_cover_update_pinned_doc_appearance(community, node_id, appearance, user, command_id)
  end

  defp doc_cover_view(args) do
    Map.get(args, :view) || :public
  end

  @doc "Reads only configuration visible to a policy administrator."
  def docs_queue_policy(_, %{community: site}, %{context: %{cur_user: actor}}) do
    publication_read_result(CMS.docs_queue_policy(site, actor))
  end

  @doc "Restores one historical Snapshot under independent edit admission."
  def restore_docs_snapshot(
        _,
        %{
          community: site,
          article_id: article,
          snapshot_id: snapshot,
          cur_user: actor,
          command_id: command
        } = args,
        _
      ) do
    publication_result(
      CMS.docs_restore_snapshot(
        site,
        article,
        snapshot,
        args[:working_copy_id],
        args[:revision],
        actor,
        command
      )
    )
  end

  @doc "Adapts authorized publication read requests without exposing internal errors."
  def docs_queue_preview(_, %{community: site} = args, %{context: %{cur_user: actor}}) do
    publication_read_result(CMS.docs_queue_preview(site, actor, Map.to_list(args)))
  end

  @doc "Reads an explicit approval comparison baseline."
  def docs_approval_diff(_, %{community: site} = args, %{context: %{cur_user: actor}}) do
    publication_read_result(CMS.docs_approval_diff(site, actor, Map.to_list(args)))
  end

  @doc "Reads authorized Release summaries."
  def docs_release_history(_, %{community: site} = args, %{context: %{cur_user: actor}}) do
    publication_read_result(CMS.docs_release_history(site, actor, Map.to_list(args)))
  end

  @doc "Reads one authorized historical site projection."
  def docs_release_detail(_, %{community: site, release_id: id} = args, %{
        context: %{cur_user: actor}
      }) do
    publication_read_result(CMS.docs_release_detail(site, actor, id, args[:article_id]))
  end

  @doc "Reads authorized Snapshot summaries and content."
  def docs_snapshot_history(_, %{community: site, article_id: id} = args, %{
        context: %{cur_user: actor}
      }) do
    publication_read_result(CMS.docs_snapshot_history(site, actor, id, Map.to_list(args)))
  end

  @doc "Reads status notices for the authenticated actor."
  def docs_publication_notices(_, %{community: site}, %{context: %{cur_user: actor}}) do
    publication_read_result(CMS.docs_publication_notices(site, actor))
  end

  @doc "Updates only approval configuration under its current policy revision."
  def configure_docs_queue(
        _,
        %{
          community: site,
          approval_policy_revision: revision,
          approval_required: required,
          allow_self_approval: self_approval,
          cur_user: actor,
          command_id: command
        },
        _
      ) do
    publication_result(
      CMS.docs_configure_queue(site, revision, required, self_approval, actor, command)
    )
  end

  defp publication_read_result({:error, :docs_preview_changed}) do
    {:error, CMS.docs_state_conflict()}
  end

  defp publication_read_result({:error, {:queue_version_conflict, _, _}}) do
    {:error, CMS.docs_state_conflict()}
  end

  defp publication_read_result({:error, reason}) when is_atom(reason) do
    {:error, CMS.docs_publication_read_unavailable()}
  end

  defp publication_read_result(result), do: result

  defp publication_result({:error, :docs_preview_changed}) do
    {:error, CMS.docs_state_conflict()}
  end

  defp publication_result({:error, {:queue_version_conflict, _, _}}) do
    {:error, CMS.docs_state_conflict()}
  end

  defp publication_result({:error, reason}) when is_atom(reason) do
    {:error, CMS.command_result_unavailable()}
  end

  defp publication_result(result), do: result
end
