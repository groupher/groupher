defmodule GroupherServerWeb.Resolvers.CMS.Communities do
  @moduledoc """
  Adapts Community, category, and tag GraphQL fields to their CMS facades.

      GraphQL Community field -> this resolver -> CMS.Communities facade
  """

  import ShortMaps
  import Absinthe.Resolution.Helpers, only: [batch: 3]

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Model.Community

  def community(_root, %{slug: slug, inc_views: inc_views}, %{context: %{cur_user: user}}) do
    CMS.Communities.fetch(slug, user, inc_views: inc_views)
  end

  def community(_root, %{slug: slug, inc_views: inc_views}, _info) do
    CMS.Communities.fetch(slug, inc_views: inc_views)
  end

  def paged_communities(_root, ~m(filter)a, %{context: %{cur_user: user}}) do
    CMS.Communities.paged(filter, user)
  end

  def paged_communities(_root, ~m(filter)a, _info) do
    CMS.Communities.paged(filter)
  end

  def create_community(_root, args, %{context: %{cur_user: user}}) do
    CMS.Communities.create(args, user)
  end

  def update_community(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.Communities.update(community, args, user)
  end

  def request_destroy_community(_root, %{community: %Community{} = community} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Communities.request_destroy(community, user, command_id: args[:command_id])
  end

  def check_community_name(_root, %{slug: slug}, _info) do
    CMS.Communities.check_name(slug)
  end

  def paged_categories(_root, ~m(filter)a, _info) do
    CMS.Communities.paged_categories(filter)
  end

  def create_category(_root, ~m(community title slug)a, %{context: %{cur_user: user}}) do
    CMS.Communities.create_category(%{community: community, title: title, slug: slug}, user)
  end

  def delete_category(_root, %{community: community, id: id}, _info) do
    CMS.Communities.delete_category(community, id)
  end

  def update_category(_root, ~m(community id title)a, %{context: %{cur_user: _}}) do
    CMS.Communities.update_category(community, %{id: id, title: title})
  end

  def set_category(_root, ~m(community category_id)a, %{context: %{cur_user: _}}) do
    CMS.Communities.set_category(community, category_id)
  end

  def unset_category(_root, ~m(community category_id)a, %{context: %{cur_user: _}}) do
    CMS.Communities.unset_category(community, category_id)
  end

  def add_moderator(_root, ~m(community user)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.add_moderator(community, user, cur_user)
  end

  def add_moderators(_root, ~m(community users)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.add_moderators(community, users, cur_user)
  end

  def remove_moderator(_root, ~m(community user)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.remove_moderator(community, user, cur_user)
  end

  def update_moderator_passport(_root, ~m(community user rules)a, %{
        context: %{cur_user: cur_user}
      }) do
    CMS.Communities.update_moderator_passport(community, rules, user, cur_user)
  end

  def paged_community_moderators(_root, ~m(community filter)a, _info) do
    CMS.Communities.members(:moderators, community, filter)
  end

  def create_community_tag(_root, %{thread: thread, community: community} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Communities.create_tag(community, thread, args, user)
  end

  def create_community_tag_group(_root, %{thread: thread, community: community} = args, _info) do
    CMS.Communities.create_tag_group(community, thread, args)
  end

  def update_community_tag(_root, %{id: id} = args, _info) do
    CMS.Communities.update_tag(id, args)
  end

  def update_community_tag_group(
        _root,
        %{id: id, thread: thread, community: community} = args,
        _info
      ) do
    CMS.Communities.update_tag_group(community, thread, id, args)
  end

  def delete_community_tag_group(_root, %{id: id, thread: thread, community: community}, _info) do
    CMS.Communities.delete_tag_group(community, thread, id)
  end

  def delete_community_tag(_root, %{id: id}, _info) do
    CMS.Communities.delete_tag(id)
  end

  def set_community_tag(_root, ~m(article community_tag_id)a, _info) do
    CMS.Communities.set_tag(article, community_tag_id)
  end

  def unset_community_tag(_root, ~m(article community_tag_id)a, _info) do
    CMS.Communities.unset_tag(article, community_tag_id)
  end

  def community_tag_groups(_root, ~m(community thread)a, _info) do
    CMS.Communities.tag_groups(~m(community thread)a)
  end

  def community_tag_stats(_root, ~m(community thread slug)a, _info) do
    CMS.Communities.tag_stats(community, thread, slug)
  end

  def community_tag_stats(root, _args, _info) do
    CMS.Communities.tag_stats(root)
  end

  def community_tag_group_title(%{tag_group: %{title: title}}, _args, _info) do
    {:ok, title}
  end

  def community_tag_group_title(%{group: group}, _args, _info) when is_binary(group) do
    {:ok, group}
  end

  def community_tag_group_title(%{group_id: group_id}, _args, _info) when not is_nil(group_id) do
    batch({CMS.Communities, :tag_group_titles}, group_id, fn titles ->
      {:ok, Map.get(titles, group_id)}
    end)
  end

  def community_tag_group_title(_, _args, _info) do
    {:ok, nil}
  end

  def reindex_community_tags(_root, ~m(community thread group_id tags)a, _info) do
    with {:ok, _} <- CMS.Communities.reindex_tags(community, thread, group_id, tags) do
      {:ok, %{done: true}}
    end
  end

  def reindex_community_tags_across_groups(_root, ~m(community thread tags)a, _info) do
    with {:ok, _} <- CMS.Communities.reindex_tags(community, thread, tags) do
      {:ok, %{done: true}}
    end
  end

  def reindex_community_tag_groups(_root, ~m(community thread groups)a, _info) do
    with {:ok, _} <- CMS.Communities.reindex_tag_groups(community, thread, groups) do
      {:ok, %{done: true}}
    end
  end

  def subscribe_community(_root, ~m(community)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.subscribe(community, cur_user)
  end

  def unsubscribe_community(_root, ~m(community)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.unsubscribe(community, cur_user)
  end

  def paged_community_subscribers(_root, ~m(community filter)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.members(:subscribers, community, filter, cur_user)
  end

  def paged_community_subscribers(_root, ~m(community filter)a, _info) do
    CMS.Communities.members(:subscribers, community, filter)
  end

  def paged_community_subscribers(_root, _args, _info) do
    {:error, "invalid args"}
  end

  def community_tags_count(root, _, _) do
    CMS.Communities.count(root, :community_tags)
  end
end
