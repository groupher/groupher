defmodule GroupherServer.Test.CMS.Review.MediaTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.CommunityAsset

  test "comment image extraction resolves only active image assets from the comment community" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    {:ok, other_community} = mock_community(owner)

    {:ok, asset} =
      insert_image_asset(
        community.id,
        "asset_comment_image",
        "communities/#{community.id}/asset/original"
      )

    {:ok, _foreign_asset} =
      insert_image_asset(
        other_community.id,
        "asset_foreign_image",
        "communities/#{other_community.id}/asset/original"
      )

    body =
      Jason.encode!(%{
        "type" => "doc",
        "content" => [
          %{
            "type" => "image",
            "attrs" => %{
              "src" => "https://assets.example/a/asset_comment_image/original"
            }
          },
          %{
            "type" => "image",
            "attrs" => %{
              "src" => "https://assets.example/a/asset_foreign_image/original"
            }
          },
          %{
            "type" => "image",
            "attrs" => %{"src" => "https://external.example/image.png"}
          }
        ]
      })

    assert [%{asset_id: asset_id, immutable_version: "sha256:comment-version"}] =
             CMS.Review.Media.comment_images(body, community.id)

    assert asset_id == asset.id
    assert CMS.Review.Media.comment_images(body, other_community.id) |> length() == 1
  end

  test "signed URL expansion is ephemeral and leaves image-free checks valid" do
    assert {:ok, %{"images" => []} = payload} =
             CMS.Review.Media.attach_signed_urls(%{"images" => [], "text" => %{"body" => "safe"}})

    assert payload["text"]["body"] == "safe"
  end

  defp insert_image_asset(community_id, public_ref, storage_key) do
    %CommunityAsset{}
    |> CommunityAsset.changeset(%{
      community_id: community_id,
      url: "https://assets.example/a/#{public_ref}/original",
      public_ref: public_ref,
      size_bytes: 1_024,
      mime_type: "image/png",
      asset_type: :image,
      status: :active,
      storage: "r2",
      storage_key: storage_key,
      content_hash: "sha256:comment-version"
    })
    |> Repo.insert()
  end
end
