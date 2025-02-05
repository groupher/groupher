defmodule GroupherServer.CMS.Delegate.ThirdPart do
  @moduledoc """
  community curd
  """
  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1]

  alias Helper.OSS

  def upload_tokens() do
    with {:ok, %{"Credentials" => credentials}} <- OSS.get_sts_token() do
      %{
        access_key_id: credentials["AccessKeyId"],
        access_key_secret: credentials["AccessKeySecret"],
        security_token: credentials["SecurityToken"],
        expiration: credentials["Expiration"]
      }
      |> done
    end
  end
end
