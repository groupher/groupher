defmodule GroupherServerWeb.Resolvers.CMS.Wallpaper do
  @moduledoc """
  Adapts wallpaper GraphQL configuration fields to the CMS wallpaper facade.

      GraphQL wallpaper field -> this resolver -> CMS.Wallpaper facade
  """

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Community

  def publish_wallpaper(
        _root,
        %{community: %Community{} = community, input: input},
        %{context: %{cur_user: %User{} = user}}
      ) do
    CMS.Wallpaper.publish(community, input, user)
  end

  def prepare_wallpaper_upload(
        _root,
        %{community: %Community{} = community, input: input},
        %{context: %{cur_user: %User{} = user}}
      ) do
    CMS.Wallpaper.prepare_upload(community, input, user)
  end

  def restore_wallpaper_snapshot(
        _root,
        %{community: %Community{} = community, input: input},
        %{context: %{cur_user: %User{} = user}}
      ) do
    CMS.Wallpaper.restore_snapshot(community, input, user)
  end
end
