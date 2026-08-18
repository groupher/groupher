defmodule GroupherServer.CMS.Assets do
  @moduledoc """
  Public facade for community assets and article document asset references.

  Assets have two separate responsibilities:

      community_assets
        - one row per uploaded/community-owned resource
        - owns storage metadata and billing bytes

      article_document_asset_refs
        - many rows per article document
        - records where an asset is used: inline block, cover, attachment

  This split keeps billing independent from article usage. A community asset is
  counted once while it is active, even if no article references it.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Assets
        -> Repo / external boundary
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Community, CommunityAsset}
  alias Helper.T

  alias __MODULE__.{ApplicationUploads, Deletion, Reader, Upload, Writer}

  @doc """
  Lists active assets owned by a community.

  The returned page only includes active, non-deleted rows. Storage usage is not
  derived from article refs; assets remain billable while active even when no
  article currently uses them.

  ## Examples

      CMS.Assets.page(community, %{page: 1, size: 20})
      #=> {:ok, %{entries: assets, total_count: total_count}}

  """
  @spec page(Community.t(), map() | nil) :: T.domain_res(T.paged_data())
  def page(%Community{} = community, filter \\ nil), do: Reader.page(community, filter)

  @doc """
  Returns storage usage for active assets in one community.

  `storage_bytes` is the sum of `community_assets.size_bytes`; repeated article
  references do not multiply the stored bytes.

  ## Examples

      CMS.Assets.usage(community)
      #=> {:ok, %{asset_count: 3, storage_bytes: 8192}}

  """
  @spec usage(Community.t()) :: T.domain_res(map())
  def usage(%Community{} = community), do: Reader.usage(community)

  @doc """
  Returns asset filter stats and community storage quota.

  Thread stats are based on `community_assets.thread` ownership. Article refs
  remain only the delete/detail usage projection.
  """
  @spec stats(Community.t(), map() | nil) :: T.domain_res(map())
  def stats(%Community{} = community, filter \\ nil), do: Reader.stats(community, filter)

  @doc """
  Lists article document refs for one community asset.

  This is the paged lookup used by the asset-library detail view. The asset must
  belong to the given community and must still be active.

  ## Examples

      CMS.Assets.refs(community, asset.id, %{page: 1, size: 20})
      #=> {:ok, %{entries: refs, total_count: total_count}}

  """
  @spec refs(Community.t(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  def refs(%Community{} = community, asset_id, filter \\ nil),
    do: Reader.refs(community, asset_id, filter)

  @doc """
  Returns the active public-read origin metadata for one asset public ref.

  This read is restricted at the GraphQL layer by server trust. It does not
  return uploader, database ids, permissions, or other dashboard-only details.
  """
  @spec origin_info(String.t()) :: T.domain_res(CommunityAsset.t())
  def origin_info(public_ref), do: Reader.origin_info(public_ref)

  @doc """
  Registers an uploaded object into a community asset library.

  The write path deduplicates active assets by URL hash, or by storage identity
  when `storage` and `storage_key` are present. Existing active rows are updated
  with the latest metadata instead of inserting duplicates.

  ## Examples

      CMS.Assets.register_to_community(community, %{url: url, size_bytes: 1024}, user)
      #=> {:ok, %CommunityAsset{}}

  """
  @spec register_to_community(Community.t(), map(), User.t() | nil) ::
          T.domain_res(CommunityAsset.t())
  def register_to_community(%Community{} = community, attrs, user \\ nil) do
    Writer.register(community, attrs, user)
  end

  @doc "Deprecated alias for register_to_community/3."
  @spec register(Community.t(), map(), User.t() | nil) :: T.domain_res(CommunityAsset.t())
  def register(%Community{} = community, attrs, user \\ nil) do
    register_to_community(community, attrs, user)
  end

  @doc "Promotes one finalized Application Logo using local database writes only."
  def register_from_application_upload(community, upload, user),
    do: ApplicationUploads.register(community, upload, user)

  @doc "Requests best-effort deletion for an expired Application Logo object."
  def delete_application_upload_object(upload) do
    Deletion.enqueue(%CommunityAsset{
      id: upload.id,
      public_ref: upload.public_ref,
      community_id: nil,
      storage: upload.storage,
      storage_key: upload.storage_key
    })
  end

  @doc "Creates a short-lived upload capability for assets-hub."
  @spec create_upload_intent(Community.t(), map(), User.t()) :: T.domain_res(map())
  def create_upload_intent(%Community{} = community, file, %User{} = user) do
    Upload.create_intent(community, file, user)
  end

  @doc "Records a verified assets-hub upload completion."
  @spec complete_upload(map()) :: T.domain_res(CommunityAsset.t())
  def complete_upload(input), do: Upload.complete(input)

  @doc """
  Soft-deletes an unreferenced community asset.

  The asset row is locked before checking refs so a concurrent ref sync cannot
  race with deletion. Referenced assets return an explicit domain error.

  ## Examples

      CMS.Assets.delete(community, asset.id)
      #=> {:ok, %CommunityAsset{status: :deleted}}

      CMS.Assets.delete(community, referenced_asset.id)
      #=> {:error, {:custom, "asset is still referenced"}}

  """
  @spec delete(Community.t(), T.id()) :: T.domain_res(CommunityAsset.t())
  def delete(%Community{} = community, asset_id) do
    with {:ok, asset} <- Writer.delete(community, asset_id) do
      Deletion.enqueue(asset)
      {:ok, asset}
    end
  end

  @doc """
  Links an article to the assets used by its current saved content.

  The article document row is locked while the article's ref set is updated to
  match the saved body and cover inputs. Pass `community: community` when the
  caller already resolved the community boundary, such as the GraphQL article
  mutation path.

  ## Examples

      CMS.Assets.link_refs(post, %{
        asset_refs: [%{asset_id: asset.id, block_id: "hero"}],
        cur_user: user
      }, community: community)
      #=> {:ok, %{body: body_refs, cover: cover_refs}}

      CMS.Assets.link_refs(post, %{asset_refs: [%{asset_id: asset.id}]})
      #=> {:ok, %{body: body_refs, cover: cover_refs}}

      CMS.Assets.link_refs(article_without_community, %{})
      #=> {:ok, :pass}

  """
  @spec link_refs(T.article(), map(), Keyword.t()) :: T.domain_res(term())
  def link_refs(article, attrs, opts \\ []) do
    case Keyword.get(opts, :community) do
      %Community{} = community -> Writer.sync_article_refs(community, article, attrs)
      nil -> Writer.sync_article_refs(article, attrs)
    end
  end

  @doc "Deprecated alias for link_refs/3."
  @spec sync_article_refs(Community.t(), T.article(), map()) :: T.domain_res(term())
  def sync_article_refs(%Community{} = community, article, attrs),
    do: link_refs(article, attrs, community: community)

  @doc "Deprecated alias for link_refs/2."
  @spec sync_article_refs(T.article(), map()) :: T.domain_res(term())
  def sync_article_refs(article, attrs), do: link_refs(article, attrs)

  @doc "Copies all derived document asset refs between two versions of one Article."
  @spec copy_refs(T.article(), T.article()) :: T.domain_res(term())
  def copy_refs(source, target), do: Writer.copy_article_refs(source, target)

  @doc "Deprecated alias for copy_refs/2."
  @spec copy_article_refs(T.article(), T.article()) :: T.domain_res(term())
  def copy_article_refs(source, target), do: copy_refs(source, target)

  @doc """
  Cleans up all persisted asset refs for one permanently deleted article.

  This is called from article deletion so the resource library keeps ownership
  data in `community_assets` while removing stale document usage rows.

  ## Examples

      CMS.Assets.cleanup_refs(:post, post.id)
      #=> {:ok, {deleted_count, nil}}

  """
  @spec cleanup_refs(atom(), T.id()) :: T.domain_res(term())
  def cleanup_refs(thread, article_id), do: Writer.purge_article_refs(thread, article_id)

  @doc "Deprecated alias for cleanup_refs/2."
  @spec purge_article_refs(atom(), T.id()) :: T.domain_res(term())
  def purge_article_refs(thread, article_id), do: cleanup_refs(thread, article_id)
end
