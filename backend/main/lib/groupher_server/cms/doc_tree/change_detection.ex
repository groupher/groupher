defmodule GroupherServer.CMS.DocTree.ChangeDetection do
  @moduledoc """
  Shared change detection for the docs draft tree and the published tree.

  The docs editor keeps a draft-side tree and publishing copies nodes to the
  public-side tree. A mapping row records the pair and the draft snapshot that
  was last published.

      draft tree                         published tree
      ----------                         --------------
      doc_tree_node_drafts.id  ----+---> doc_tree_nodes.id
                                  |
                                  v
      doc_tree_node_publish_mappings
        draft_node_id
        published_node_id
        draft_node_updated_at
        draft_doc_content_hash
        visibility

  A public mapping is considered content-dirty only when the document draft
  differs from the last published article snapshot:

      article draft content_hash != mapping.draft_doc_content_hash

  Tree-node fields such as title, href, marker, parent, and index are now owned
  by Tree staged events. They should light up the Tree footer, not every page or
  link row.
  """

  alias GroupherServer.CMS.Model.{
    ArticleDraft,
    DocTreeNodeDraft,
    DocTreeNodePublishMapping
  }

  @spec unpublished_mapping?(
          DocTreeNodeDraft.t(),
          DocTreeNodePublishMapping.t() | nil,
          term(),
          ArticleDraft.t() | nil
        ) :: boolean()
  def unpublished_mapping?(_node, nil, _published_node, _draft_doc), do: true

  def unpublished_mapping?(
        _node,
        %DocTreeNodePublishMapping{visibility: :draft},
        _published_node,
        _draft_doc
      ),
      do: true

  def unpublished_mapping?(
        %DocTreeNodeDraft{},
        %DocTreeNodePublishMapping{visibility: :public} = mapping,
        _published_node,
        draft_doc
      ) do
    draft_doc_content_changed?(draft_doc, mapping.draft_doc_content_hash)
  end

  @spec draft_doc_content_changed?(ArticleDraft.t() | nil, String.t() | nil) :: boolean()
  def draft_doc_content_changed?(nil, _content_hash), do: false

  def draft_doc_content_changed?(%ArticleDraft{} = draft_doc, content_hash) do
    draft_doc.content_hash != content_hash
  end
end
