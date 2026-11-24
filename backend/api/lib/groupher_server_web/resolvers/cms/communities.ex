defmodule GroupherServerWeb.Resolvers.CMS.Communities do
  @moduledoc """
  Adapts Community, category, and tag GraphQL fields to their CMS facades.

      GraphQL Community field -> this resolver -> CMS.Communities facade
  """

  import ShortMaps
  import Absinthe.Resolution.Helpers, only: [batch: 3]

  alias GroupherServer.Pagi
  alias GroupherServer.CMS
  alias CMS.Model.Community

  @doc "Fetches a community by slug for the optional viewer, honoring the requested view-count flag."
  def community(_root, %{slug: slug, inc_views: inc_views}, %{context: %{cur_user: user}}) do
    CMS.communities_fetch(slug, user, inc_views: inc_views)
  end

  def community(_root, %{slug: slug, inc_views: inc_views}, _info) do
    CMS.communities_fetch(slug, inc_views: inc_views)
  end

  @doc "Pages communities using the supplied filter and optional viewer."
  def paged_communities(_root, args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.communities_paged(Map.get(args, :filter) || %{}, pagi, Map.get(context, :cur_user))
    end
  end

  @doc "Creates a community for the signed-in actor, passing command identity separately from attributes."
  def create_community(_root, args, %{context: %{cur_user: user}}) do
    CMS.communities_create(Map.delete(args, :command_id), user, args[:command_id])
  end

  @doc "Updates the resolved community with the supplied attributes and command identity."
  def update_community(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: user}}
      ) do
    params = Map.drop(args, [:community, :command_id])
    CMS.communities_update(community, params, user, args[:command_id])
  end

  @doc "Submits the actor's request to destroy the community rather than deleting it directly."
  def request_destroy_community(_root, %{community: %Community{} = community} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.communities_request_destroy(community, user, command_id: args[:command_id])
  end

  @doc "Checks whether the requested community slug is available."
  def check_community_name(_root, %{slug: slug}, _info) do
    CMS.communities_check_name(slug)
  end

  @doc "Lists the community categories in the CMS catalog."
  def categories(_root, _args, _info), do: CMS.communities_categories()

  @doc "Creates a category with a title and slug in the supplied community context."
  def create_category(_root, ~m(community title slug command_id)a, %{context: %{cur_user: user}}) do
    CMS.communities_create_category(
      %{community: community, title: title, slug: slug},
      user,
      command_id
    )
  end

  @doc "Deletes the identified category in the supplied community context."
  def delete_category(_root, %{community: community, id: id, command_id: command_id}, %{
        context: %{cur_user: user}
      }) do
    CMS.communities_delete_category(community, id, user, command_id)
  end

  @doc "Updates a category's title by ID in the supplied community context."
  def update_category(_root, ~m(community id title command_id)a, %{context: %{cur_user: user}}) do
    CMS.communities_update_category(community, %{id: id, title: title}, user, command_id)
  end

  @doc "Assigns an existing category to the community identified by the input."
  def set_category(_root, ~m(community category_id command_id)a, %{context: %{cur_user: user}}) do
    with {:ok, community} <- resolve_community(community) do
      CMS.communities_set_category(community, category_id, user, command_id)
    end
  end

  @doc "Removes the category assignment without deleting the category."
  def unset_category(_root, ~m(community category_id command_id)a, %{context: %{cur_user: user}}) do
    with {:ok, community} <- resolve_community(community) do
      CMS.communities_unset_category(community, category_id, user, command_id)
    end
  end

  defp resolve_community(%Community{} = community), do: {:ok, community}
  defp resolve_community(ref), do: GroupherServer.CMS.front_desk_community(ref, mode: :internal)

  def create_community_tag(
        _root,
        %{thread: thread, community: community, command_id: command_id} = args,
        %{
          context: %{cur_user: user}
        }
      ) do
    CMS.communities_create_tag(community, thread, args, user, command_id)
  end

  @doc "Creates a tag group for the specified community and thread."
  def create_community_tag_group(
        _root,
        %{thread: thread, community: community, command_id: command_id} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.communities_create_tag_group(community, thread, args, user, command_id)
  end

  @doc "Updates the tag identified by ID using the submitted attributes."
  def update_community_tag(_root, %{id: id, command_id: command_id} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.communities_update_tag(id, args, user, command_id)
  end

  @doc "Updates a tag group by ID within its community and thread."
  def update_community_tag_group(
        _root,
        %{id: id, thread: thread, community: community, command_id: command_id} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.communities_update_tag_group(community, thread, id, args, user, command_id)
  end

  @doc "Deletes the specified tag group within its community and thread."
  def delete_community_tag_group(
        _root,
        %{id: id, thread: thread, community: community, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.communities_delete_tag_group(community, thread, id, user, command_id)
  end

  @doc "Deletes the community tag identified by ID."
  def delete_community_tag(_root, %{id: id, command_id: command_id}, %{context: %{cur_user: user}}) do
    CMS.communities_delete_tag(id, user, command_id)
  end

  @doc "Assigns the specified community tag to the resolved article."
  def set_community_tag(_root, ~m(article community_tag_id command_id)a, %{
        context: %{cur_user: user}
      }) do
    CMS.communities_set_tag(article, community_tag_id, user, command_id)
  end

  @doc "Removes the specified tag from the article without deleting the tag."
  def unset_community_tag(_root, ~m(article community_tag_id command_id)a, %{
        context: %{cur_user: user}
      }) do
    CMS.communities_unset_tag(article, community_tag_id, user, command_id)
  end

  @doc "Lists tag groups for the requested community and thread."
  def community_tag_groups(_root, ~m(community thread)a, _info) do
    CMS.communities_tag_groups(~m(community thread)a)
  end

  @doc "Reads tag statistics from the parent tag or by community, thread, and slug."
  def community_tag_stats(_root, ~m(community thread slug)a, _info) do
    CMS.communities_tag_stats(community, thread, slug)
  end

  def community_tag_stats(root, _args, _info) do
    CMS.communities_tag_stats(root)
  end

  @doc "Returns the supplied group title or name, batching lookups when only a group ID is available."
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

  @doc "Reorders tags within one group and returns a done flag on success."
  def reindex_community_tags(_root, ~m(community thread group_id tags command_id)a, %{
        context: %{cur_user: user}
      }) do
    with {:ok, _} <-
           CMS.communities_reindex_tags_in_group(
             community,
             thread,
             group_id,
             tags,
             user,
             command_id
           ) do
      {:ok, %{done: true}}
    end
  end

  @doc "Reindexes tags across groups in the community thread and returns a done flag on success."
  def reindex_community_tags_across_groups(_root, ~m(community thread tags command_id)a, %{
        context: %{cur_user: user}
      }) do
    with {:ok, _} <-
           CMS.communities_reindex_tags_across_groups(community, thread, tags, user, command_id) do
      {:ok, %{done: true}}
    end
  end

  @doc "Reorders the community thread's tag groups and returns a done flag on success."
  def reindex_community_tag_groups(_root, ~m(community thread groups command_id)a, %{
        context: %{cur_user: user}
      }) do
    with {:ok, _} <-
           CMS.communities_reindex_tag_groups(community, thread, groups, user, command_id) do
      {:ok, %{done: true}}
    end
  end

  @doc "Subscribes the signed-in user to the resolved community."
  def subscribe_community(_root, ~m(community command_id)a, %{context: %{cur_user: cur_user}}) do
    CMS.communities_subscribe(community, cur_user, command_id)
  end

  @doc "Removes the signed-in user's subscription to the resolved community."
  def unsubscribe_community(_root, ~m(community command_id)a, %{context: %{cur_user: cur_user}}) do
    CMS.communities_unsubscribe(community, cur_user, command_id)
  end

  @doc "Pages community subscribers using the requested filter and optional viewer."
  def paged_community_subscribers(_root, %{community: community} = args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.communities_members(
        :subscribers,
        community,
        Map.get(args, :filter) || %{},
        pagi,
        Map.get(context, :cur_user)
      )
    end
  end

  @doc "Returns the number of tags associated with the parent community."
  def community_tags_count(root, _, _) do
    CMS.communities_count(root, :community_tags)
  end
end
