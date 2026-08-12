defmodule GroupherServer.Test.Query.CMS.Assets do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  @asset_refs_query S.Asset.q(:community_asset_refs)
  @origin_info_query S.Asset.q(:community_asset_origin_info)
  @test_service_identity "enabled"

  setup do
    {community, post, _attrs, user} = mock_article(:post)
    asset_conn = simu_conn(:user, user, cms: %{community.slug => %{"asset.upload" => true}})

    server_conn =
      :guest
      |> simu_conn()
      |> Plug.Conn.put_req_header("x-groupher-test-service-identity", @test_service_identity)

    {:ok, ~m(asset_conn community post server_conn user)a}
  end

  describe "[cms assets]" do
    test "asset upload passport can page article refs for one asset",
         ~m(asset_conn community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(community, image_asset_attrs("query-refs.png", 70), user)

      asset_refs =
        Enum.map(1..25, fn position ->
          %{asset_id: asset.id, position: position, source: "query-refs.png"}
        end)

      assert {:ok, %{body: refs, cover: []}} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: asset_refs
                 },
                 community: community
               )

      assert length(refs) == 25

      result =
        asset_conn
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

    test "scoped service query can read asset origin info", ~m(community server_conn user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("origin-query.png", 128)
          |> Map.merge(%{
            content_hash: "sha256:origin-query",
            meta: %{r2Head: %{etag: "etag-origin-query"}},
            public_ref: "asset_origin_query",
            storage: "r2",
            storage_key: "communities/groupher/assets/2026_07/29_origin_query/original"
          }),
          user
        )

      result =
        server_conn
        |> gq_query(@origin_info_query, %{publicRef: asset.public_ref})

      assert result["publicRef"] == "asset_origin_query"
      assert result["status"] == "ACTIVE"
      assert result["deletedAt"] == nil
      assert result["filename"] == "origin-query.png"
      assert result["storage"] == "r2"

      assert result["storageKey"] ==
               "communities/groupher/assets/2026_07/29_origin_query/original"

      assert result["mimeType"] == "image/png"
      assert result["sizeBytes"] == "128"
      assert result["width"] == 640
      assert result["height"] == 360
      assert result["meta"]["r2Head"]["etag"] == "etag-origin-query"
    end

    test "origin info query requires a scoped service identity", ~m(user)a do
      conn = simu_conn(:user, user)

      assert conn
             |> query_error?(
               @origin_info_query,
               %{publicRef: "asset_origin_query"},
               ecode(:service_identity)
             )
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
