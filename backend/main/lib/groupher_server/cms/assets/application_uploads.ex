defmodule GroupherServer.CMS.Assets.ApplicationUploads do
  @moduledoc """
  Promotes one finalized Application Logo into Community ownership using DB writes only.

  Business position:

      Dashboard / editor
        -> CMS.Assets
        -> ApplicationUploads
        -> Repo / Assets Hub
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Assets.Write
  alias GroupherServer.CMS.Model.{Community, CommunityApplicationLogoUpload}
  alias Helper.Utils

  @spec register(Community.t(), CommunityApplicationLogoUpload.t(), User.t()) ::
          {:ok, term()} | {:error, term()}
  def register(
        %Community{} = community,
        %CommunityApplicationLogoUpload{} = upload,
        %User{} = user
      ) do
    Write.register(
      community,
      %{
        public_ref: "asset_" <> Utils.uid(24),
        url: upload.url,
        storage: upload.storage,
        storage_key: upload.storage_key,
        content_hash: upload.content_hash,
        size_bytes: upload.size_bytes,
        filename: upload.filename,
        mime_type: upload.mime_type,
        asset_type: :image,
        uploader_id: user.id,
        meta: %{
          "source" => "community_application_logo",
          "applicationUploadRef" => upload.public_ref
        }
      },
      user
    )
  end
end
