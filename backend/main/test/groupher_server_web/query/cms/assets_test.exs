defmodule GroupherServer.Test.Query.CMS.Assets do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  @asset_refs_query """
  query($community: String!, $assetId: ID!, $filter: PagiFilter) {
    communityAssetRefs(community: $community, assetId: $assetId, filter: $filter) {
      entries {
        id
        articleId
        usage
        source
      }
      totalCount
      totalPages
      pageSize
      pageNumber
    }
  }
  """

  setup do
    {community, post, _attrs, user} = mock_article(:post)
    rule_conn = simu_conn(:user, user, cms: %{"community.update" => true})

    {:ok, ~m(community post rule_conn user)a}
  end

  describe "[cms assets]" do
    test "authorized user can page article refs for one asset",
         ~m(community post rule_conn user)a do
      {:ok, asset} = CMS.Assets.register(community, image_asset_attrs("query-refs.png", 70), user)

      asset_refs =
        Enum.map(1..25, fn position ->
          %{asset_id: asset.id, position: position, source: "query-refs.png"}
        end)

      assert {:ok, %{body: refs, cover: []}} =
               CMS.Assets.sync_article_refs(community, post, %{
                 cur_user: user,
                 asset_refs: asset_refs
               })

      assert length(refs) == 25

      result =
        rule_conn
        |> gq_query(@asset_refs_query, %{
          community: community.slug,
          assetId: asset.id,
          filter: %{page: 1, size: 10}
        })

      assert result |> is_valid_pagination?
      assert result["totalCount"] == 25
      assert result["totalPages"] == 3
      assert result["pageSize"] == 10
      assert result["pageNumber"] == 1
      assert length(result["entries"]) == 10

      first_entry = hd(result["entries"])
      assert first_entry["articleId"] == to_string(post.id)
      assert first_entry["usage"] == "INLINE"
      assert first_entry["source"] == "query-refs.png"
    end
  end

  defp image_asset_attrs(filename, size_bytes) do
    %{
      asset_type: :image,
      filename: filename,
      mime_type: "image/png",
      url: "https://assets.groupher.test/#{filename}",
      size_bytes: size_bytes,
      width: 640,
      height: 360
    }
  end
end
