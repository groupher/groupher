defmodule GroupherServer.Helpdesk do
  @moduledoc """
  provide quick info to outside
  """
  alias GroupherServer.CMS.Model.Community
  alias Helper.ORM
  alias GroupherServer.CMS
  alias CMS.Model.{Community}

  def info(:community, slug) when is_binary(slug) do
    ORM.find_by(Community, %{slug: slug})
  end
end
