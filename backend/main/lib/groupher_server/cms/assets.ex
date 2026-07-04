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

  alias __MODULE__.{Read, Write}

  @spec page(Community.t(), map() | nil) :: T.domain_res(T.paged_data())
  def page(%Community{} = community, filter \\ nil), do: Read.page(community, filter)

  @spec usage(Community.t()) :: T.domain_res(map())
  def usage(%Community{} = community), do: Read.usage(community)

  @spec refs(CommunityAsset.t()) :: T.domain_res(list())
  def refs(%CommunityAsset{} = asset), do: Read.refs(asset)

  @spec register(Community.t(), map(), User.t() | nil) :: T.domain_res(CommunityAsset.t())
  def register(%Community{} = community, attrs, user \\ nil) do
    Write.register(community, attrs, user)
  end

  @spec delete(Community.t(), T.id()) :: T.domain_res(CommunityAsset.t())
  def delete(%Community{} = community, asset_id), do: Write.delete(community, asset_id)

  @spec sync_article_refs(Community.t(), T.article(), map()) :: T.domain_res(term())
  def sync_article_refs(%Community{} = community, article, attrs) do
    Write.sync_article_refs(community, article, attrs)
  end

  @spec sync_article_refs(T.article(), map()) :: T.domain_res(term())
  def sync_article_refs(article, attrs), do: Write.sync_article_refs(article, attrs)

  @spec purge_article_refs(atom(), T.id()) :: T.domain_res(term())
  def purge_article_refs(thread, article_id), do: Write.purge_article_refs(thread, article_id)
end
