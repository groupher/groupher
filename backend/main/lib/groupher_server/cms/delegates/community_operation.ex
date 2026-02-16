defmodule GroupherServer.CMS.Delegate.CommunityOperation do
  @moduledoc """
  community operations, like: set/unset category/thread/moderator...
  """
  alias GroupherServer.CMS.Communities

  defdelegate set_category(community, category), to: Communities.Category, as: :set
  defdelegate unset_category(community, category), to: Communities.Category, as: :unset

  defdelegate set_thread(community, thread), to: Communities.Thread, as: :set
  defdelegate unset_thread(community, thread), to: Communities.Thread, as: :unset

  defdelegate add_moderator(community, role, target_user, cur_user), to: Communities.Moderator, as: :add
  defdelegate remove_moderator(community, target_user, cur_user), to: Communities.Moderator, as: :remove
  defdelegate update_moderator_passport(community, rules, target_user, cur_user), to: Communities.Moderator, as: :update_passport

  defdelegate subscribe_community(community, user), to: Communities.Subscribe, as: :subscribe
  defdelegate unsubscribe_community(community, user), to: Communities.Subscribe, as: :unsubscribe
  defdelegate subscribe_community_ifnot(community, user), to: Communities.Subscribe, as: :subscribe_ifnot
  defdelegate subscribe_default_community_ifnot(user), to: Communities.Subscribe, as: :subscribe_default_ifnot
end
