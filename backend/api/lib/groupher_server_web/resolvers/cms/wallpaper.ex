defmodule GroupherServerWeb.Resolvers.CMS.Wallpaper do
  @moduledoc """
  Adapts wallpaper GraphQL configuration fields to the CMS wallpaper facade.

      GraphQL wallpaper field -> this resolver -> CMS.Wallpaper facade
  """

  alias GroupherServer.Accounts

  alias GroupherServer.CMS
  alias Accounts.Model.User
  alias CMS.Model.Community

  @doc "Publishes the supplied wallpaper configuration for the community on behalf of the signed-in user."
  def publish_wallpaper(
        _root,
        %{community: %Community{} = community, input: input},
        %{context: %{cur_user: %User{} = user}}
      ) do
    CMS.publish_wallpaper(community, input, user)
  end

  @doc "Prepares a wallpaper upload for the community using the actor and submitted upload details."
  def prepare_wallpaper_upload(
        _root,
        %{community: %Community{} = community, input: input},
        %{context: %{cur_user: %User{} = user}}
      ) do
    CMS.prepare_wallpaper_upload(community, input, user)
  end

  @doc "Restores the requested wallpaper snapshot for the community on behalf of the signed-in user."
  def restore_wallpaper_snapshot(
        _root,
        %{community: %Community{} = community, input: input},
        %{context: %{cur_user: %User{} = user}}
      ) do
    CMS.restore_wallpaper_snapshot(community, input, user)
  end
end
