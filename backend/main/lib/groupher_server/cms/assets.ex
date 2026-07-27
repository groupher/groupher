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
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Community, CommunityAsset}
  alias Helper.T

  alias __MODULE__.{Read, Upload, Write}

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
  def page(%Community{} = community, filter \\ nil), do: Read.page(community, filter)

  @doc """
  Returns storage usage for active assets in one community.

  `storage_bytes` is the sum of `community_assets.size_bytes`; repeated article
  references do not multiply the stored bytes.

  ## Examples

      CMS.Assets.usage(community)
      #=> {:ok, %{asset_count: 3, storage_bytes: 8192}}

  """
  @spec usage(Community.t()) :: T.domain_res(map())
  def usage(%Community{} = community), do: Read.usage(community)

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
    do: Read.refs(community, asset_id, filter)

  @doc """
  Registers an uploaded object as a community asset.

  The write path deduplicates active assets by URL hash, or by storage identity
  when `storage` and `storage_key` are present. Existing active rows are updated
  with the latest metadata instead of inserting duplicates.

  ## Examples

      CMS.Assets.register(community, %{url: url, size_bytes: 1024}, user)
      #=> {:ok, %CommunityAsset{}}

  """
  @spec register(Community.t(), map(), User.t() | nil) :: T.domain_res(CommunityAsset.t())
  def register(%Community{} = community, attrs, user \\ nil) do
    Write.register(community, attrs, user)
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
  def delete(%Community{} = community, asset_id), do: Write.delete(community, asset_id)

  @doc """
  Replaces article document refs using an explicit community.

  Use this when the caller already resolved the community boundary, such as the
  GraphQL article mutation path. The article document row is locked while refs
  are replaced.

  ## Examples

      CMS.Assets.sync_article_refs(community, post, %{
        asset_refs: [%{asset_id: asset.id, block_id: "hero"}],
        cur_user: user
      })
      #=> {:ok, %{body: body_refs, cover: cover_refs}}

  """
  @spec sync_article_refs(Community.t(), T.article(), map()) :: T.domain_res(term())
  def sync_article_refs(%Community{} = community, article, attrs) do
    Write.sync_article_refs(community, article, attrs)
  end

  @doc """
  Replaces article document refs using `article.community_id`.

  This variant is used from article flows where the article already carries its
  community foreign key. If the article has no community, the sync is skipped.

  ## Examples

      CMS.Assets.sync_article_refs(post, %{asset_refs: [%{asset_id: asset.id}]})
      #=> {:ok, %{body: body_refs, cover: cover_refs}}

      CMS.Assets.sync_article_refs(article_without_community, %{})
      #=> {:ok, :pass}

  """
  @spec sync_article_refs(T.article(), map()) :: T.domain_res(term())
  def sync_article_refs(article, attrs), do: Write.sync_article_refs(article, attrs)

  @doc "Copies all derived document asset refs between two versions of one Article."
  @spec copy_article_refs(T.article(), T.article()) :: T.domain_res(term())
  def copy_article_refs(source, target), do: Write.copy_article_refs(source, target)

  @doc """
  Deletes all persisted asset refs for one article.

  This is called from article deletion so the resource library keeps ownership
  data in `community_assets` while removing stale document usage rows.

  ## Examples

      CMS.Assets.purge_article_refs(:post, post.id)
      #=> {:ok, {deleted_count, nil}}

  """
  @spec purge_article_refs(atom(), T.id()) :: T.domain_res(term())
  def purge_article_refs(thread, article_id), do: Write.purge_article_refs(thread, article_id)
end
