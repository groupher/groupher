defmodule GroupherServer.CMS.Delegate.CommunityCRUD do
  @moduledoc """
  community curd
  """
  alias GroupherServer.CMS.Communities

  defdelegate read_community(slug), to: Communities.Read, as: :read
  defdelegate read_community(slug, opt), to: Communities.Read, as: :read
  defdelegate read_community(slug, user), to: Communities.Read, as: :read
  defdelegate read_community(slug, user, opt), to: Communities.Read, as: :read

  defdelegate paged_communities(filter), to: Communities.List, as: :paged
  defdelegate paged_communities(filter, user), to: Communities.List, as: :paged

  defdelegate create_community(args, user), to: Communities.Write, as: :create
  defdelegate delete_community(community), to: Communities.Write, as: :delete
  defdelegate update_community(community, args), to: Communities.Write, as: :update

  defdelegate update_dashboard(community, key, args), to: Communities.Dashboard, as: :update

  defdelegate community_exist?(slug), to: Communities.Read, as: :exist?
  defdelegate has_pending_community_apply?(user), to: Communities.Apply, as: :has_pending?

  defdelegate apply_community(args, user), to: Communities.Apply, as: :apply
  defdelegate approve_community_apply(slug), to: Communities.Apply, as: :approve
  defdelegate deny_community_apply(id), to: Communities.Apply, as: :deny

  defdelegate update_community_count_field(community, user, type, opt), to: Communities.Count, as: :update
  defdelegate update_community_count_field(community, type), to: Communities.Count, as: :update
  defdelegate update_community_count_field(communities, thread), to: Communities.Count, as: :update
  defdelegate update_community_inner_id(community, thread, inner_id), to: Communities.Count, as: :update_inner_id

  defdelegate community_members(type, community, filters), to: Communities.Members, as: :members
  defdelegate community_members(type, community, filters, user), to: Communities.Members, as: :members

  defdelegate create_category(attrs, user), to: Communities.Category, as: :create
  defdelegate update_category(attrs), to: Communities.Category, as: :update

  defdelegate create_thread(attrs), to: Communities.Thread, as: :create

  defdelegate count(community, type), to: Communities.Count
end
