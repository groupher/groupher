defmodule GroupherServer.CMS.DocTree.TrashSnapshot do
  @moduledoc """
  Serializes and restores draft doc payloads stored inside doc tree trash items.

  The trash row owns the deleted tree node snapshot. Page nodes can also carry a
  nested draft-doc snapshot so both restore paths rebuild the same draft content:

      delete page
          |
          v
      DocTreeTrashItem.node_snapshot
          |
          +--> tree node fields
          |
          +--> "draftDoc"
                 |
                 +--> docs row fields
                 |
                 +--> article_documents row fields
          |
          +--------------------+
                               |
             +-----------------+-----------------+
             |                                   |
             v                                   v
      product Trash drawer restore       publish checklist restore
             |                                   |
             +-----------------+-----------------+
                               |
                               v
                    restore docs + ArticleDocument
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    ArticleDocument,
    Community,
    Doc,
    DocTreeTrashItem
  }

  alias Helper.ORM

  require CMS.Const

  @trash_snapshot_key_draft_doc CMS.Const.doc_tree_trash_snapshot_key(:draft_doc)

  @doc """
  Builds the nested draft-doc snapshot for a page doc id.
  """
  @spec draft_doc_snapshot(Community.t(), any(), Ecto.UUID.t()) :: map() | nil
  def draft_doc_snapshot(%Community{} = community, branch, doc_id) do
    with %Doc{} = draft <- draft_doc_by_doc_id(community, branch, doc_id),
         %ArticleDocument{} = document <- draft_article_document(draft) do
      %{
        "doc" => doc_snapshot(draft),
        "document" => article_document_snapshot(document)
      }
    else
      _ -> nil
    end
  end

  @doc """
  Loads the newest unrestored draft-doc snapshot for a deleted node id.
  """
  @spec draft_snapshot_from_trash(Community.t(), any(), binary()) ::
          {:ok, map()} | {:error, :not_found}
  def draft_snapshot_from_trash(%Community{} = community, branch, node_id) do
    DocTreeTrashItem
    |> where([item], item.community_id == ^community.id)
    |> where([item], item.branch_id == ^branch.id)
    |> where([item], item.node_id == ^to_string(node_id))
    |> where([item], is_nil(item.restored_at))
    |> order_by([item], desc: item.deleted_at, desc: item.id)
    |> limit(1)
    |> select([item], item.node_snapshot)
    |> Repo.one()
    |> fetch_draft_doc_snapshot()
  end

  @doc """
  Extracts the nested draft-doc snapshot from a trash node snapshot.
  """
  @spec fetch_draft_doc_snapshot(map() | nil) :: {:ok, map()} | {:error, :not_found}
  def fetch_draft_doc_snapshot(%{@trash_snapshot_key_draft_doc => draft_snapshot})
      when is_map(draft_snapshot),
      do: {:ok, draft_snapshot}

  def fetch_draft_doc_snapshot(_snapshot), do: {:error, :not_found}

  @doc """
  Recreates a draft `Doc` and its `ArticleDocument` from a trash snapshot.
  """
  @spec restore_doc_draft(Community.t(), any(), map()) :: :ok | {:error, any()}
  def restore_doc_draft(%Community{} = community, branch, %{
        "doc" => doc_snapshot,
        "document" => document_snapshot
      })
      when is_map(doc_snapshot) and is_map(document_snapshot) do
    with {:ok, draft} <- ORM.create(Doc, doc_attrs_from_snapshot(community, branch, doc_snapshot)),
         {:ok, _document} <-
           ORM.create(ArticleDocument, document_attrs_from_snapshot(draft, document_snapshot)) do
      :ok
    end
  end

  def restore_doc_draft(_community, _branch, _snapshot), do: :ok

  @doc "Deletes the ArticleDocument rows owned by the supplied draft Docs."
  @spec delete_article_documents([Doc.t()]) :: :ok
  def delete_article_documents([]), do: :ok

  def delete_article_documents(drafts) do
    draft_ids = Enum.map(drafts, & &1.id)

    ArticleDocument
    |> where([document], document.thread == :doc)
    |> where([document], document.article_id in ^draft_ids)
    |> Repo.delete_all()

    :ok
  end

  @doc "Returns draft Docs for the supplied product-level doc ids."
  @spec draft_docs_by_doc_ids(Community.t(), any(), [Ecto.UUID.t()]) :: [Doc.t()]
  def draft_docs_by_doc_ids(_community, _branch, []), do: []

  def draft_docs_by_doc_ids(%Community{} = community, branch, doc_ids) do
    Doc
    |> where([doc], doc.community_id == ^community.id)
    |> where([doc], doc.branch_id == ^branch.id)
    |> where([doc], doc.stage == CMS.Const.stage(:draft))
    |> where([doc], doc.article_hash_id in ^doc_ids)
    |> Repo.all()
  end

  defp draft_doc_by_doc_id(%Community{} = community, branch, doc_id) do
    Doc
    |> where([doc], doc.community_id == ^community.id)
    |> where([doc], doc.branch_id == ^branch.id)
    |> where([doc], doc.stage == CMS.Const.stage(:draft))
    |> where([doc], doc.article_hash_id == ^doc_id)
    |> Repo.one()
  end

  defp draft_article_document(%Doc{} = draft) do
    ArticleDocument
    |> where([document], document.article_id == ^draft.id)
    |> where([document], document.thread == :doc)
    |> Repo.one()
  end

  defp doc_snapshot(%Doc{} = draft) do
    %{
      "docId" => draft.article_hash_id,
      "title" => draft.title,
      "subtitle" => draft.subtitle,
      "slug" => draft.slug,
      "digest" => draft.digest,
      "json" => draft.json,
      "contentHash" => draft.content_hash,
      "schemaVersion" => draft.schema_version,
      "templateKey" => draft.template_key,
      "authorId" => draft.author_id,
      "linkAddr" => draft.link_addr,
      "coverUrl" => draft.cover_url,
      "coverUrlDark" => draft.cover_url_dark,
      "meta" => embed_snapshot(draft.meta)
    }
  end

  defp article_document_snapshot(%ArticleDocument{} = document) do
    %{
      "title" => document.title,
      "json" => document.json,
      "markdown" => document.markdown,
      "markdownToc" => document.markdown_toc,
      "html" => document.html,
      "xml" => document.xml,
      "rss" => document.rss,
      "plainText" => document.plain_text,
      "digest" => document.digest,
      "contentHash" => document.content_hash,
      "schemaVersion" => document.schema_version
    }
  end

  defp doc_attrs_from_snapshot(%Community{} = community, branch, snapshot) do
    %{
      community_id: community.id,
      branch_id: branch.id,
      stage: CMS.Const.stage(:draft),
      article_hash_id: snapshot["docId"],
      title: snapshot["title"],
      subtitle: snapshot["subtitle"],
      slug: snapshot["slug"],
      digest: snapshot["digest"],
      json: snapshot["json"],
      content_hash: snapshot["contentHash"],
      schema_version: snapshot["schemaVersion"],
      template_key: snapshot["templateKey"],
      author_id: snapshot["authorId"],
      link_addr: snapshot["linkAddr"],
      cover_url: snapshot["coverUrl"],
      cover_url_dark: snapshot["coverUrlDark"],
      meta: snapshot["meta"]
    }
  end

  defp document_attrs_from_snapshot(%Doc{} = draft, snapshot) do
    %{
      thread: :doc,
      article_id: draft.id,
      title: snapshot["title"] || draft.title,
      json: snapshot["json"] || draft.json,
      markdown: snapshot["markdown"],
      markdown_toc: snapshot["markdownToc"],
      html: snapshot["html"],
      xml: snapshot["xml"],
      rss: snapshot["rss"],
      plain_text: snapshot["plainText"],
      digest: snapshot["digest"],
      content_hash: snapshot["contentHash"],
      schema_version: snapshot["schemaVersion"]
    }
  end

  defp embed_snapshot(nil), do: nil

  defp embed_snapshot(%schema{} = embed) do
    schema.__schema__(:fields)
    |> Enum.reject(&(&1 == :id))
    |> Enum.map(fn field -> {Atom.to_string(field), snapshot_value(Map.get(embed, field))} end)
    |> Enum.into(%{})
  end

  defp snapshot_value(nil), do: nil
  defp snapshot_value(%DateTime{} = value), do: DateTime.to_iso8601(value)
  defp snapshot_value(%NaiveDateTime{} = value), do: NaiveDateTime.to_iso8601(value)
  defp snapshot_value(value) when is_atom(value), do: to_string(value)
  defp snapshot_value(values) when is_list(values), do: Enum.map(values, &snapshot_value/1)

  defp snapshot_value(%schema{} = value) do
    if function_exported?(schema, :__schema__, 1) do
      embed_snapshot(value)
    else
      value
    end
  end

  defp snapshot_value(value), do: value
end
