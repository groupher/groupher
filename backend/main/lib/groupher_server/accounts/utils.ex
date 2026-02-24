defmodule GroupherServer.Accounts.Utils do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.Utils

  @spec get_userid_and_cache(String.t()) :: T.domain_res(T.id())
  def get_userid_and_cache(login), do: Utils.get_userid_and_cache(login)
end
