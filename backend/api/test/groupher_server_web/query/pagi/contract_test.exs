defmodule GroupherServerWeb.PagiContractTest do
  use ExUnit.Case, async: true
  alias GroupherServerWeb.Schema

  @pages ~w(community_moderator_page user_page community_page collect_folder_page article_collection_page comment_collection_page comment_page post_page blog_page changelog_page doc_page paged_mailbox_mentions paged_mailbox_notifications community_asset_page article_asset_ref_page trash_page artiment_mention_page article_log_page community_activity_page community_application_page community_application_event_page search_artiment_page doc_tree_trash_page doc_branch_version_page browser_session_page)a

  test "every paginated resource exposes entries and the single PageInfo union" do
    for name <- @pages do
      type = Absinthe.Schema.lookup_type(Schema, name)
      assert type, "missing canonical page #{name}"
      assert Map.has_key?(type.fields, :entries), "#{name} has no entries"
      assert Map.has_key?(type.fields, :page_info), "#{name} has no PageInfo"

      refute Enum.any?(
               [:page_number, :page_size, :total_pages, :total_count],
               &Map.has_key?(type.fields, &1)
             ),
             "#{name} exposes obsolete metadata"
    end
  end

  test "obsolete pagination types and entry points are deleted" do
    for name <-
          ~w(paged_posts paged_blogs paged_docs paged_changelogs paged_comments paged_users pagi_filter common_paged_filter paged_posts_filter community_application_connection community_application_event_connection report_page report_filter abuse_report abuse_report_case)a do
      assert is_nil(Absinthe.Schema.lookup_type(Schema, name)), "obsolete type #{name} remains"
    end

    query = Absinthe.Schema.lookup_type(Schema, :query)

    for field <-
          ~w(paged_posts paged_blogs paged_docs paged_changelogs paged_kanban_posts paged_categories)a do
      refute Map.has_key?(query.fields, field), "obsolete query #{field} remains"
    end
  end

  test "business filters cannot carry a second pagination grammar" do
    for name <-
          ~w(post_filter changelog_filter article_page_filter communities_filter user_list_filter mailbox_mentions_filter mailbox_notifications_filter community_asset_filter trash_filter community_applications_filter)a do
      type = Absinthe.Schema.lookup_type(Schema, name)
      assert type, "missing filter #{name}"

      refute Enum.any?(
               [:page, :size, :first, :after, :config_revision],
               &Map.has_key?(type.fields, &1)
             ),
             "#{name} mixes positions and business filters"
    end

    assert {:ok, %{errors: errors}} =
             Absinthe.run(
               "{postPage(filter: {community: \"xx\", page: 1}) {entries {innerId}}}",
               Schema
             )

    assert Enum.any?(errors, &String.contains?(&1.message, "page"))
  end

  test "community mode is scalar and obsolete full-list fields are absent" do
    dashboard = Absinthe.Schema.lookup_type(Schema, :dsb)
    assert Map.has_key?(dashboard.fields, :pagi_mode)
    assert Map.has_key?(dashboard.fields, :pagi_revision)
    refute Map.has_key?(dashboard.fields, :pagination)
    refute Map.has_key?(Absinthe.Schema.lookup_type(Schema, :community).fields, :moderators)
    refute Map.has_key?(Absinthe.Schema.lookup_type(Schema, :category).fields, :communities)
  end

  test "Article list types are Lite projections" do
    for name <- ~w(post_lite blog_lite changelog_lite doc_lite)a do
      type = Absinthe.Schema.lookup_type(Schema, name)

      for field <- [:body, :meta, :article_stats, :assets, :viewer_has_upvoted] do
        refute Map.has_key?(type.fields, field)
      end
    end
  end
end
