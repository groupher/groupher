defmodule GroupherServerWeb.Schema.CMS.Spec do
  @moduledoc """
  GraphQL object and payload types for the CMS domain.

  These types define the user-facing CMS data contract used by query and
  mutation fields in Playground, including communities, articles, comments,
  dashboard settings, moderation payloads, and pagination wrappers.

  Business position:

      Client
        -> Absinthe schema / Types
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields
  import GroupherServerWeb.Schema.Helper.Objects

  import Ecto.Query, warn: false, except: [union: 2]
  import Absinthe.Resolution.Helpers, only: [dataloader: 2]

  alias GroupherServer.CMS

  alias CMS.Dashboard.{ThemePreset, ThirdPartyAnalytics}

  alias CMS.Model.CoverBackground

  alias GroupherServerWeb.Schema
  import_types(Schema.CMS.Metrics)

  enum :passport_action do
    passport_action_values()
  end

  object :global_passport do
    @desc "Whether this account has global root privileges."
    field(:is_root, non_null(:boolean))
    @desc "Global Passport actions available to the account."
    field(:permissions, non_null(list_of(non_null(:passport_action))))
  end

  enum :community_article_trash_thread do
    @desc "A post removed from the community."
    value(:post)
    @desc "A blog article removed from the community."
    value(:blog)
    @desc "A changelog entry removed from the community."
    value(:changelog)
    @desc "A Doc removed from the community tree."
    value(:doc)
  end

  enum :community_article_trash_status do
    @desc "Removal is pending."
    value(:pending)
    @desc "Removal has taken effect."
    value(:effective)
  end

  enum :article_event_type do
    @desc "An article was created."
    value(:create)
    @desc "Article content was edited."
    value(:edit)
    @desc "A saved version was restored."
    value(:restore)
    @desc "A working copy was forked."
    value(:fork)
    @desc "An article version was published."
    value(:publish)
  end

  enum :article_version_type do
    @desc "An immutable saved article version."
    value(:snapshot)
    @desc "An editable copy at a particular revision."
    value(:working_copy)
  end

  input_object :article_version_ref_input do
    @desc "Which kind of saved version to select."
    field(:type, non_null(:article_version_type))
    @desc "ID when selecting an immutable snapshot."
    field(:snapshot_id, :id)
    @desc "ID when selecting an editable copy."
    field(:working_copy_id, :id)
    @desc "Revision of the selected working copy."
    field(:revision, :integer)
  end

  interface :community_article_trash_item do
    community_article_trash_fields()

    resolve_type(fn
      %{thread: :doc}, _ ->
        :community_doc_tree_trash_item

      %{thread: thread}, _ when thread in [:post, :blog, :changelog] ->
        :community_article_binding_trash_item

      _, _ ->
        nil
    end)
  end

  object :community_article_binding_trash_item do
    interface(:community_article_trash_item)
    community_article_trash_fields()
    @desc "ID of the hidden community binding."
    field(:binding_id, non_null(:id))
    @desc "Stable ID of the article behind this binding."
    field(:article_id, non_null(:id))
    @desc "When the binding was hidden."
    field(:hidden_at, non_null(:datetime))
    @desc "Title of the hidden article."
    field(:title, :string)
    @desc "Command associated with the removal."
    field(:command_id, :id)
  end

  object :community_doc_tree_trash_item do
    interface(:community_article_trash_item)
    community_article_trash_fields()
    @desc "Navigation path for the removed subtree."
    field(:tree_path, non_null(list_of(non_null(:community_doc_trash_path_segment))))
    @desc "Number of subtree members still pending removal."
    field(:pending_member_count, non_null(:integer))
    @desc "Number of subtree members already removed."
    field(:removed_member_count, non_null(:integer))

    field :paged_members, non_null(:community_doc_trash_member_page) do
      arg(:pagi, :pagi_input)
      arg(:record_revision, :string)
      resolve(&R.CMS.CommunityTrash.doc_members/3)
    end

    field(:title, :string)
    field(:node_id, :id)
    field(:doc_id, :id)
    field(:type, :string)
    field(:deleted_from_parent_node_id, :id)
    field(:deleted_from_index, :integer)
  end

  object :community_doc_trash_path_segment do
    @desc "Logical node ID for this path segment."
    field(:node_id, non_null(:id))
    @desc "Navigation label for this path segment."
    field(:title, non_null(:string))
  end

  object :community_doc_trash_member do
    field(:id, non_null(:id))
    field(:title, :string)
    field(:deletion_status, non_null(:community_article_trash_status))
    field(:removed_from_public, non_null(:boolean))
  end

  object :community_doc_trash_member_page do
    field(:entries, non_null(list_of(non_null(:community_doc_trash_member))))
    pagi_fields()
  end

  object :community_article_trash_page do
    @desc "Removed article bindings and Docs subtrees on this page."
    field(:entries, non_null(list_of(non_null(:community_article_trash_item))))
    pagi_fields()
  end

  enum :artiment_type do
    @desc "A post in a community."
    value(:post)
    @desc "A blog article."
    value(:blog)
    @desc "A changelog entry."
    value(:changelog)
    @desc "A documentation article."
    value(:doc)
    @desc "A ticket."
    value(:ticket)
    @desc "A comment on an article."
    value(:comment)
  end

  enum :artiment_read_status do
    @desc "The viewer can read the target."
    value(:readable)
    @desc "The target is marked deleted."
    value(:deleted)
    @desc "The target cannot be read in this context."
    value(:unavailable)
  end

  input_object :artiment_status_input do
    @desc "Kind of content identified by this locator."
    field(:type, non_null(:artiment_type))
    @desc "Community-local number of the article."
    field(:article_inner_id, :id)
    @desc "Stable article ID, independent of the route."
    field(:article_id, :id)
    @desc "Number of the comment within its article."
    field(:comment_inner_id, :id)
  end

  input_object :mentions_graph_locator_input do
    @desc "Kind of content identified by this locator."
    field(:type, non_null(:artiment_type))
    @desc "Community-local number of the article."
    field(:article_inner_id, :id)
    @desc "Stable article ID, independent of the route."
    field(:article_id, :id)
    @desc "Number of the comment within its article."
    field(:comment_inner_id, :id)
  end

  object :mentions_graph_locator do
    @desc "Kind of content identified by this locator."
    field(:type, non_null(:artiment_type))
    @desc "Community-local number of the article."
    field(:article_inner_id, :id)
    @desc "Stable article ID, independent of the route."
    field(:article_id, :id)
    @desc "Number of the comment within its article."
    field(:comment_inner_id, :id)
  end

  object :mentions_graph_node do
    @desc "Identifier used by graph edges to reference this node."
    field(:id, non_null(:id))
    @desc "Kind of content represented by the node."
    field(:type, non_null(:artiment_type))
    @desc "Read availability for this viewer."
    field(:status, non_null(:artiment_read_status))
    @desc "Display title when available."
    field(:title, :string)
    @desc "Navigation URL when available."
    field(:url, :string)
    @desc "Structured identity of the underlying content."
    field(:locator, :mentions_graph_locator)
    @desc "Whether the viewer can open the target."
    field(:can_open, non_null(:boolean))
  end

  object :artiment_status do
    @desc "Kind of content evaluated."
    field(:type, non_null(:artiment_type))
    @desc "Read availability for this viewer."
    field(:status, non_null(:artiment_read_status))
    @desc "Display title when available."
    field(:title, :string)
    @desc "Navigation URL when available."
    field(:url, :string)
  end

  object :mentions_graph_edge do
    @desc "Identifier of this directed mention relationship."
    field(:id, non_null(:id))
    @desc "ID of the node containing the mention."
    field(:from, non_null(:id))
    @desc "ID of the node being mentioned."
    field(:to, non_null(:id))
    @desc "Number of occurrences represented by this edge."
    field(:occurrences_count, non_null(:integer))
  end

  object :mentions_graph_page do
    @desc "Revision of the returned mention graph."
    field(:revision, non_null(:id))
    @desc "Content nodes in this graph page."
    field(:nodes, non_null(list_of(non_null(:mentions_graph_node))))
    @desc "Directed mention relationships in this page."
    field(:edges, non_null(list_of(non_null(:mentions_graph_edge))))
    @desc "Whether more relationships are available."
    field(:has_next_page, non_null(:boolean))
    @desc "Cursor for continuing this graph traversal."
    field(:end_cursor, :string)
  end

  object :mentions_graph_article_comments_page do
    @desc "Revision of the mention graph for this page."
    field(:revision, non_null(:id))
    @desc "Locators of comments associated with the focused article."
    field(:comments, non_null(list_of(non_null(:mentions_graph_locator))))
    @desc "Whether more comments are available."
    field(:has_next_page, non_null(:boolean))
    @desc "Cursor for retrieving the next page of comments."
    field(:end_cursor, :id)
  end

  object :community_name_check do
    @desc "Normalized slug checked against the shared namespace."
    field(:normalized_slug, :string)
    @desc "Whether the normalized slug can be claimed."
    field(:available, non_null(:boolean))
    @desc "Machine-readable reason for the availability result."
    field(:reason_code, :string)
  end

  object :done_state do
    @desc "Whether the requested operation completed successfully."
    field(:done, :boolean)
    @desc "Identifier of the command that produced this result."
    field(:command_id, :id, resolve: &GroupherServerWeb.Resolvers.CMS.CommandPayload.command_id/3)
  end

  object :article_view_track_result do
    @desc "Whether this read was counted."
    field(:tracked, non_null(:boolean))
    @desc "Article statistics after processing the read."
    field(:article_stats, non_null(:article_stats))
    @desc "Viewer read state after processing the read."
    field(:viewer_state, non_null(:viewer_article_state))
  end

  enum :reaction_outcome do
    @desc "The requested reaction changed stored state."
    value(:changed)
    @desc "The requested state already held."
    value(:unchanged)
  end

  object :article_emotion_count do
    @desc "Reaction being counted."
    field(:type, non_null(:article_emotion))
    @desc "Number of reactions of this type."
    field(:count, non_null(:integer))
  end

  object :article_stats do
    @desc "Community slug in the article path."
    field(:community, non_null(:string))
    @desc "Thread in the article path."
    field(:thread, non_null(:thread))
    @desc "Community-local article number."
    field(:inner_id, non_null(:id))
    @desc "Recorded article views."
    field(:views, non_null(:integer))
    @desc "Revision of the view counter."
    field(:views_revision, non_null(:integer))
    @desc "Recorded upvotes."
    field(:upvotes_count, non_null(:integer))
    @desc "Recorded comments."
    field(:comments_count, non_null(:integer))
    @desc "Number of collections of this article."
    field(:collects_count, non_null(:integer))
    @desc "Number of distinct comment participants."
    field(:comments_participants_count, non_null(:integer))
    @desc "User snapshots for the comment participants returned."
    field(:comments_participants, non_null(list_of(non_null(:participant_snapshot_user))))
    @desc "Revision of the reaction and collection counts."
    field(:interaction_revision, non_null(:integer))
    @desc "Revision of the comment counts and participants."
    field(:comments_revision, non_null(:integer))
    @desc "Reaction counts grouped by emotion."
    field(:emotion_counts, non_null(list_of(non_null(:article_emotion_count))))
    @desc "When this statistics snapshot was produced."
    field(:snapshot_at, non_null(:datetime))
  end

  enum :ticket_type_enum do
    @desc "User-facing ticket that can be published."
    value(:user)
    @desc "Internal work item under a user ticket."
    value(:worker)
    @desc "Internal case grouping related tickets."
    value(:case)
  end

  enum :ticket_status_enum do
    @desc "Work has not yet started."
    value(:todo)
    @desc "Work is in progress."
    value(:wip)
    @desc "Work is complete."
    value(:done)
    @desc "The case is open."
    value(:open)
    @desc "The case is resolved."
    value(:resolved)
  end

  enum :ticket_publication_state do
    @desc "Ticket content is in draft."
    value(:draft)
    @desc "Ticket content has a public version."
    value(:published)
  end

  enum :ticket_source_type_enum do
    @desc "A post linked as a ticket source."
    value(:post)
  end

  enum :ticket_update_visibility_enum do
    @desc "Update intended for the public ticket timeline."
    value(:public)
    @desc "Update restricted to internal readers."
    value(:internal)
  end

  input_object :ticket_filter do
    @desc "Match tickets of this kind."
    field(:type, :ticket_type_enum)
    @desc "Match this workflow state."
    field(:status, :ticket_status_enum)
    field(:assignee_login, :string)
    field(:priority, :integer)
    @desc "Match the specified ticket tags."
    field(:tag_ids, list_of(:integer))
    @desc "Filter by version facet values."
    field(:versions, list_of(:string))
    @desc "Filter by operating-system facet values."
    field(:operating_systems, list_of(:string))
    @desc "Filter by module facet values."
    field(:modules, list_of(:string))
    @desc "Include tickets created at or after this time."
    field(:created_after, :datetime)
    @desc "Include tickets created at or before this time."
    field(:created_before, :datetime)
    @desc "Include tickets updated at or after this time."
    field(:updated_after, :datetime)
    @desc "Include tickets updated at or before this time."
    field(:updated_before, :datetime)
    @desc "Include tickets whose planned end is at or after this time."
    field(:planned_after, :datetime)
    @desc "Include tickets whose planned start is at or before this time."
    field(:planned_before, :datetime)
  end

  input_object :ticket_facet_input do
    @desc "Facet dimension, such as version or operating system."
    field(:key, non_null(:string))
    @desc "Value within the selected dimension."
    field(:value, non_null(:string))
  end

  object :ticket_assignee do
    field(:user, non_null(:common_user))
  end

  object :ticket_tag_ref do
    @desc "ID of the linked tag."
    field(:id, non_null(:integer))
    @desc "Display label for the tag."
    field(:title, non_null(:string))
    @desc "Tag identifier used in routes."
    field(:slug, non_null(:string))
    @desc "Display color assigned to the tag."
    field(:color, :string)
  end

  object :ticket_facet do
    @desc "Facet dimension, such as version or operating system."
    field(:key, non_null(:string))
    @desc "Value within the selected dimension."
    field(:value, non_null(:string))
  end

  object :ticket_source_ref do
    @desc "ID of the source relation, used to unlink it."
    field(:id, non_null(:id))
    @desc "Kind of content linked as a source."
    field(:type, non_null(:ticket_source_type_enum))
    @desc "Community-local number of the source post."
    field(:inner_id, :integer)
    @desc "Title of the source post."
    field(:title, :string)
    @desc "Whether the source is public."
    field(:is_public, non_null(:boolean))
    @desc "Review restrictions reported on this source."
    field(:review_block_types, non_null(list_of(non_null(:string))))
  end

  object :ticket_progress_ref do
    @desc "ID used to reference the ticket in this projection."
    field(:id, non_null(:id))
    @desc "Community-local ticket number."
    field(:inner_id, non_null(:integer))
    @desc "Ticket headline."
    field(:title, non_null(:string))
    @desc "Workflow state summarized for the post."
    field(:status, non_null(:ticket_status_enum))
  end

  object :ticket_relation_ref do
    @desc "ID of the related ticket."
    field(:id, non_null(:id))
    @desc "Kind of related ticket."
    field(:type, non_null(:ticket_type_enum))
    @desc "Workflow state of the related ticket."
    field(:status, non_null(:ticket_status_enum))
    @desc "Priority assigned to the ticket."
    field(:priority, non_null(:integer))
    @desc "Revision of its workflow state."
    field(:workflow_version, non_null(:integer))
    @desc "Sort position in its work column."
    field(:rank, non_null(:integer))
    @desc "Community-local number, when assigned."
    field(:inner_id, :integer)
    @desc "Ticket headline."
    field(:title, non_null(:string))
    @desc "Summary of the ticket content."
    field(:digest, :string)
    @desc "Scheduled start of work."
    field(:planned_start_at, :datetime)
    @desc "Scheduled end of work."
    field(:planned_end_at, :datetime)
  end

  object :ticket do
    @desc "Ticket identifier for this projection; public reads use the community ticket number."
    field(:id, non_null(:id))
    @desc "Community-local number, when assigned."
    field(:inner_id, :integer)
    @desc "User ticket, worker or case."
    field(:type, non_null(:ticket_type_enum))
    @desc "Current work or case status."
    field(:status, non_null(:ticket_status_enum))
    @desc "Publication state, separate from work status."
    field(:publication_state, non_null(:ticket_publication_state))
    @desc "Whether a public update can currently be published for this ticket."
    field(:can_publish_public_updates, non_null(:boolean))
    @desc "Priority assigned to the ticket."
    field(:priority, non_null(:integer))
    @desc "Expected version for publication changes on internal reads."
    field(:lifecycle_version, :integer)
    @desc "Expected version for workflow changes on internal reads."
    field(:workflow_version, :integer)
    @desc "Revision of the editable draft on internal reads."
    field(:working_copy_revision, :integer)
    @desc "Sort position in the work column."
    field(:rank, non_null(:integer))
    @desc "Headline of the selected ticket content."
    field(:title, non_null(:string))
    @desc "Summary of the selected content."
    field(:digest, non_null(:string))
    @desc "Rich-text body serialized as JSON."
    field(:body, non_null(:string), resolve: fn ticket, _, _ -> {:ok, ticket.body.json} end)

    @desc "Ticket body without rich-text formatting."
    field(:plain_text, non_null(:string),
      resolve: fn ticket, _, _ -> {:ok, ticket.body.plain_text} end
    )

    @desc "Preview anchor used by the internal ticket publication workflow."
    field(:publication_preview, :string)
    @desc "Editable ticket content on internal reads."
    field(:draft_content, :ticket_content)
    @desc "Content of the published version."
    field(:published_content, :ticket_content)
    @desc "Whether draft content differs from the published content."
    field(:has_unpublished_changes, :boolean)
    @desc "Scheduled start of work."
    field(:planned_start_at, :datetime)
    @desc "Scheduled end of work."
    field(:planned_end_at, :datetime)
    @desc "When work started."
    field(:started_at, :datetime)
    @desc "When work completed."
    field(:completed_at, :datetime)
    @desc "When the ticket was created."
    field(:created_at, non_null(:datetime))
    @desc "When the ticket was last updated."
    field(:updated_at, non_null(:datetime))
    @desc "Accounts assigned to the ticket."
    field(:assignees, non_null(list_of(non_null(:ticket_assignee))))
    @desc "Tags linked to the ticket."
    field(:tags, non_null(list_of(non_null(:ticket_tag_ref))))
    @desc "Normalized classification dimensions and values."
    field(:facets, non_null(list_of(non_null(:ticket_facet))))
    @desc "Source records linked to this ticket."
    field(:sources, non_null(list_of(non_null(:ticket_source_ref))))
    @desc "Worker tickets belonging to this user ticket."
    field(:workers, non_null(list_of(non_null(:ticket_relation_ref))))
    @desc "User tickets grouped by this case."
    field(:members, non_null(list_of(non_null(:ticket_relation_ref))))
    @desc "Cases containing this user ticket."
    field(:cases, non_null(list_of(non_null(:ticket_relation_ref))))
    @desc "Worker tickets referenced as shared fixes for the case."
    field(:shared_workers, non_null(list_of(non_null(:ticket_relation_ref))))
    @desc "Parent user ticket for a worker."
    field(:parent, :ticket_relation_ref)

    @desc "Paged activity history for this ticket."
    field :activity, :ticket_activity_connection do
      arg(:pagi, :pagi_input)
      resolve(&R.CMS.Tickets.activity/3)
    end

    @desc "Progress updates visible in this projection."
    field(:updates, non_null(list_of(non_null(:ticket_update))))
  end

  object :ticket_content do
    @desc "Ticket headline."
    field(:title, non_null(:string))
    @desc "Short summary of the content."
    field(:digest, non_null(:string))
    @desc "Rich-text document serialized as JSON."
    field(:body, non_null(:string), resolve: fn content, _, _ -> {:ok, content.body.json} end)
  end

  object :ticket_activity_connection do
    @desc "Ticket history events on this page."
    field(:entries, non_null(list_of(non_null(:ticket_activity))))
    @desc "Pagination boundaries for the current result set."
    field(:page_info, non_null(:page_info))
  end

  input_object :ticket_content_input do
    @desc "Headline to save in the draft."
    field(:title, :string)
    @desc "Summary to save in the draft."
    field(:digest, :string)
    @desc "Rich-text JSON document to save in the draft."
    field(:body, :json)
  end

  object :ticket_activity do
    @desc "ID of the ticket activity event."
    field(:id, non_null(:id))
    @desc "Action that was recorded."
    field(:action, non_null(:string))
    @desc "Details specific to the recorded action."
    field(:payload, :json)
    @desc "When the action occurred."
    field(:occurred_at, non_null(:datetime))
    @desc "Reference of the actor who performed the action."
    field(:actor_ref, :id)
  end

  object :ticket_page do
    @desc "Tickets matching the query on this page."
    field(:entries, non_null(list_of(non_null(:ticket))))
    @desc "Pagination boundaries for the current result set."
    field(:page_info, non_null(:page_info))
  end

  object :ticket_kanban_columns do
    @desc "Tickets awaiting work."
    field(:todo, non_null(:ticket_page))
    @desc "Tickets with work in progress."
    field(:wip, non_null(:ticket_page))
    @desc "Tickets whose work is complete."
    field(:done, non_null(:ticket_page))
  end

  object :post_ticket_progress do
    @desc "Community-local number of the source post."
    field(:post_inner_id, non_null(:integer))
    @desc "Aggregate work status of the linked tickets."
    field(:status, non_null(:ticket_status_enum))
    @desc "Number of completed linked tickets."
    field(:completed, non_null(:integer))
    @desc "Total linked tickets represented."
    field(:total, non_null(:integer))
    @desc "Linked tickets contributing to the aggregate."
    field(:tickets, non_null(list_of(non_null(:ticket_progress_ref))))
  end

  object :ticket_update do
    @desc "ID of the progress update."
    field(:id, non_null(:id))
    @desc "Content of the progress update."
    field(:body, non_null(:string))
    @desc "Whether this update is public or internal."
    field(:visibility, non_null(:ticket_update_visibility_enum))
    @desc "Account that authored the update."
    field(:author_id, non_null(:id))
    @desc "When the update was published."
    field(:published_at, :datetime)
    @desc "ID of the earlier update replaced by this one."
    field(:supersedes_id, :id)
  end

  object :article_reaction_result do
    @desc "Identifier of the reaction command."
    field(:command_id, non_null(:id))
    @desc "Whether the command changed the reaction."
    field(:reaction_outcome, non_null(:reaction_outcome))
    @desc "Article statistics after the command."
    field(:article_stats, non_null(:article_stats))
    @desc "Viewer's interaction state after the command."
    field(:interaction_state, non_null(:article_interaction_state))
  end

  object :article_collect_result do
    @desc "Identifier of the collection command."
    field(:command_id, non_null(:id))
    @desc "Collection folder affected by the command."
    field(:folder, non_null(:collect_folder))
    @desc "Article statistics after the command."
    field(:article_stats, non_null(:article_stats))
    @desc "Viewer's interaction state after the command."
    field(:interaction_state, non_null(:article_interaction_state))
  end

  object :article_comment_result do
    @desc "Identifier of the comment command."
    field(:command_id, non_null(:id))
    @desc "Comment returned by the command, when present."
    field(:comment, :comment)
    @desc "Article statistics after the command."
    field(:article_stats, non_null(:article_stats))
  end

  enum :community_application_status do
    @desc "Submitted and awaiting review."
    value(:submitted)
    @desc "A reviewer is evaluating the application."
    value(:reviewing)
    @desc "Approved for community creation."
    value(:approved)
    @desc "Community creation failed."
    value(:creation_failed)
    @desc "Community setup is running."
    value(:setting_up)
    @desc "Community setup failed."
    value(:setup_failed)
    @desc "The community has been created and set up."
    value(:created)
    @desc "Declined by a reviewer."
    value(:rejected)
    @desc "Withdrawn by the applicant."
    value(:cancelled)
    @desc "The application passed its deadline."
    value(:expired)
  end

  enum :community_application_category do
    @desc "Community for a product."
    value(:product, as: :PRODUCT)
    @desc "Community for gaming."
    value(:gaming, as: :GAMING)
    @desc "Community for teaching and learning."
    value(:teach, as: :TEACH)
    @desc "Community for a group."
    value(:group, as: :GROUP)
  end

  enum :community_application_actor_type do
    @desc "Person applying for the community."
    value(:applicant)
    @desc "Person reviewing the application."
    value(:reviewer)
    @desc "Background job processing the application."
    value(:job)
    @desc "System-initiated action."
    value(:system)
  end

  enum :community_lifecycle_state do
    @desc "Initial setup is in progress."
    value(:setting_up)
    @desc "Initial setup failed."
    value(:setup_failed)
    @desc "Community is operational."
    value(:active)
    @desc "Reads are allowed but writes are restricted."
    value(:read_only)
    @desc "Community access is suspended."
    value(:suspended)
    @desc "Community has been archived."
    value(:archived)
    @desc "Community is awaiting permanent removal."
    value(:pending_destroy)
    @desc "Community is permanently removed."
    value(:destroy)
  end

  enum :article_lifecycle_state do
    @desc "Content has not been published."
    value(:draft)
    @desc "A public article version is selected."
    value(:published)
    @desc "The article is archived."
    value(:archived)
    @desc "The article has been moved to trash."
    value(:deleted)
    @desc "The article is permanently removed."
    value(:destroy)
  end

  enum :comment_lifecycle_state do
    @desc "The comment has not been removed."
    value(:visible)
    @desc "The comment is marked deleted."
    value(:deleted)
    @desc "The comment is permanently removed."
    value(:destroy)
  end

  object :article_lifecycle do
    @desc "Current article lifecycle state."
    field(:state, non_null(:article_lifecycle_state))
    @desc "Revision of the article lifecycle state."
    field(:version, non_null(:integer))
    @desc "When the current state took effect."
    field(:changed_at, :datetime)
    @desc "When the article was archived."
    field(:archived_at, :datetime)
    @desc "When the article was marked deleted."
    field(:deleted_at, :datetime)
    @desc "When permanent removal was recorded."
    field(:destroyed_at, :datetime)
  end

  object :comment_lifecycle do
    @desc "Current comment lifecycle state."
    field(:state, non_null(:comment_lifecycle_state))
    @desc "When the current state took effect."
    field(:changed_at, :datetime)
    @desc "When the comment was marked deleted."
    field(:deleted_at, :datetime)
    @desc "When permanent removal was recorded."
    field(:destroyed_at, :datetime)
  end

  enum :community_lifecycle_blocker_type do
    @desc "Archive initiated by the community owner."
    value(:owner_archive)
    @desc "Suspension imposed by moderation."
    value(:moderation_suspend)
    @desc "Archive imposed by moderation."
    value(:moderation_archive)
    @desc "Legal hold imposed by operations."
    value(:ops_legal_hold)
  end

  enum :community_lifecycle_blocker_end_type do
    @desc "The blocker was lifted."
    value(:released)
    @desc "The blocker ended when the community was permanently removed."
    value(:terminated)
  end

  object :community_application_actor do
    @desc "Public reference of the account associated with the application."
    field(:public_ref, non_null(:id),
      resolve: &GroupherServerWeb.Resolvers.CMS.CommunityApplications.application_actor_ref/3
    )
  end

  object :community_application_community do
    @desc "Public reference of the resulting community."
    field(:public_ref, non_null(:id),
      resolve: &GroupherServerWeb.Resolvers.CMS.CommunityApplications.application_community_ref/3
    )

    @desc "Route slug of the resulting community."
    field(:slug, non_null(:string))
  end

  object :community_application_logo do
    @desc "Reference of the application-scoped logo upload."
    field(:application_upload_ref, non_null(:id))
    @desc "Reference of the community asset created from the logo, when available."
    field(:community_asset_ref, :id)
    @desc "URL for displaying the application logo."
    field(:url, non_null(:string))
  end

  object :community_application_job_error do
    @desc "Machine-readable job failure reason."
    field(:reason_code, non_null(:string))
    @desc "Explanation of the job failure."
    field(:message, non_null(:string))
    @desc "Reference correlating the failure with its operation."
    field(:operation_ref, :id)
    @desc "When the failure occurred."
    field(:occurred_at, :datetime)
    @desc "Job attempt that produced this failure."
    field(:attempt, :integer)
  end

  object :community_application_event do
    @desc "Status before the transition, if any."
    field(:from_status, :community_application_status)
    @desc "Status after the transition."
    field(:to_status, non_null(:community_application_status))
    @desc "Kind of actor that triggered the event."
    field(:actor_type, non_null(:community_application_actor_type))

    @desc "Account responsible for the transition, when available."
    field(:actor, :community_application_actor,
      resolve: &GroupherServerWeb.Resolvers.CMS.CommunityApplications.application_event_actor/3
    )

    @desc "Machine-readable reason for the transition."
    field(:reason_code, :string)
    @desc "Reference correlating events from the same operation."
    field(:operation_ref, :id)
    @desc "When the transition occurred."
    field(:occurred_at, non_null(:datetime))
  end

  object :community_application_event_page do
    @desc "Application transitions on this page."
    field(:entries, non_null(list_of(non_null(:community_application_event))))
    pagi_fields()
  end

  object :community_application do
    @desc "Public reference used to retrieve the application."
    field(:public_ref, non_null(:id))
    @desc "Current stage in the application workflow."
    field(:status, non_null(:community_application_status))
    @desc "Revision of the application."
    field(:version, non_null(:integer))

    @desc "Account requesting the community."
    field(:applicant, non_null(:community_application_actor),
      resolve: &GroupherServerWeb.Resolvers.CMS.CommunityApplications.application_applicant/3
    )

    @desc "Account reviewing the application."
    field(:reviewer, :community_application_actor,
      resolve: &GroupherServerWeb.Resolvers.CMS.CommunityApplications.application_reviewer/3
    )

    @desc "Requested community display name."
    field(:title, non_null(:string))
    @desc "Requested community route slug."
    field(:slug, non_null(:string))
    @desc "Proposed community introduction."
    field(:desc, non_null(:string))

    @desc "Logo submitted with the application."
    field(:logo, non_null(:community_application_logo),
      resolve: &GroupherServerWeb.Resolvers.CMS.CommunityApplications.community_application_logo/3
    )

    @desc "Requested community language."
    field(:locale, non_null(:string))
    @desc "Kind of community requested."
    field(:apply_category, non_null(:community_application_category))
    @desc "Message from the applicant to the reviewer."
    field(:apply_message, :string)
    @desc "When the application was submitted."
    field(:submitted_at, non_null(:datetime))
    @desc "Deadline for this application."
    field(:expires_at, :datetime)
    @desc "When review was recorded."
    field(:reviewed_at, :datetime)
    @desc "When community setup began."
    field(:setup_started_at, :datetime)
    @desc "When the application completed."
    field(:completed_at, :datetime)
    @desc "When the application last changed."
    field(:updated_at, non_null(:datetime))
    @desc "Machine-readable reason for the review decision."
    field(:decision_reason_code, :string)
    @desc "Reviewer's note accompanying the decision."
    field(:decision_note, :string)

    @desc "Community created from the application, when available."
    field(:community, :community_application_community,
      resolve: &GroupherServerWeb.Resolvers.CMS.CommunityApplications.application_community/3
    )

    @desc "Most recent job failure associated with the application."
    field(:last_job_error, :community_application_job_error,
      resolve: &GroupherServerWeb.Resolvers.CMS.CommunityApplications.application_job_error/3
    )

    @desc "Paged history of application transitions."
    field :events, non_null(:community_application_event_page) do
      arg(:pagi, :pagi_input)

      resolve(
        &GroupherServerWeb.Resolvers.CMS.CommunityApplications.community_application_events/3
      )
    end
  end

  object :community_application_page do
    @desc "Community applications matching the queue filters."
    field(:entries, non_null(list_of(non_null(:community_application))))
    pagi_fields()
  end

  object :community_application_policy do
    @desc "Whether the viewer may submit an application."
    field(:allowed, non_null(:boolean))
    @desc "Machine-readable reason for the admission result."
    field(:reason_code, :string)
    @desc "When the viewer may try again, if applicable."
    field(:retry_at, :datetime)
    @desc "Additional details about the admission decision."
    field(:metadata, non_null(:json))
  end

  object :community_application_state do
    @desc "Current policy decision for submitting an application."
    field(:can_apply, non_null(:community_application_policy))
    @desc "Application currently in progress, if any."
    field(:current_application, :community_application)
    @desc "Most recent failed application, if any."
    field(:latest_failed_application, :community_application)
  end

  input_object :community_application_input do
    @desc "Requested community display name."
    field(:title, non_null(:string))
    @desc "Requested community route slug."
    field(:slug, non_null(:string))
    @desc "Proposed community introduction."
    field(:desc, non_null(:string))
    @desc "Reference of the application logo upload."
    field(:logo_asset_ref, non_null(:id))
    @desc "Requested community language."
    field(:locale, non_null(:string))
    @desc "Kind of community requested."
    field(:apply_category, non_null(:community_application_category))
    @desc "Message for the reviewer."
    field(:apply_message, :string)
  end

  input_object :application_logo_upload_input do
    @desc "Original logo filename."
    field(:file_name, non_null(:string))
    @desc "Declared media type of the logo."
    field(:mime_type, non_null(:string))
    @desc "Declared file size in bytes."
    field(:size_bytes, non_null(:integer))
  end

  object :application_logo_upload_intent do
    @desc "Reference assigned to this logo upload."
    field(:upload_ref, non_null(:id))
    @desc "Storage key assigned to the logo."
    field(:object_key, non_null(:string))
    @desc "Canonical URL assigned to the logo."
    field(:canonical_url, non_null(:string))
    @desc "Authorization token for this upload."
    field(:capability, non_null(:string))
    @desc "When the upload authorization expires."
    field(:expires_at, non_null(:datetime))
    @desc "Maximum accepted upload size in bytes."
    field(:max_size_bytes, non_null(:integer))
    @desc "Media types accepted for the logo."
    field(:allowed_mime_types, non_null(list_of(non_null(:string))))
  end

  object :application_logo_upload_completion do
    @desc "Reference of the finalized logo upload."
    field(:upload_ref, non_null(:id), resolve: fn upload, _, _ -> {:ok, upload.public_ref} end)
    @desc "Recorded state of the logo upload."
    field(:status, non_null(:string))
    @desc "URL of the finalized logo."
    field(:url, non_null(:string))
    @desc "When finalization completed."
    field(:finalized_at, non_null(:datetime))
  end

  object :application_logo_origin_info do
    @desc "Public reference of the logo upload."
    field(:public_ref, non_null(:id))
    @desc "Recorded upload state."
    field(:status, non_null(:string))
    @desc "Original logo filename."
    field(:filename, :string)
    @desc "Media type of the stored logo."
    field(:mime_type, :string)
    @desc "Size of the stored logo in bytes."
    field(:size_bytes, :integer)
    @desc "Storage provider holding the logo."
    field(:storage, :string)
    @desc "Key of the logo within that provider."
    field(:storage_key, :string)
  end

  input_object :community_application_logo_completion_input do
    @desc "Reference assigned to the logo upload."
    field(:upload_ref, non_null(:id))
    @desc "Provider holding the uploaded logo."
    field(:storage, non_null(:string))
    @desc "Object key in the provider."
    field(:storage_key, non_null(:string))
    @desc "URL of the uploaded logo."
    field(:url, non_null(:string))
    @desc "Fingerprint of the uploaded bytes."
    field(:content_hash, non_null(:string))
    @desc "Media type of the uploaded logo."
    field(:mime_type, non_null(:string))
    @desc "Uploaded file size in bytes."
    field(:size_bytes, non_null(:integer))
  end

  input_object :community_applications_filter do
    @desc "Include applications in these workflow states."
    field(:statuses, list_of(non_null(:community_application_status)))
    @desc "Restrict to this applicant's public reference."
    field(:applicant_ref, :id)
    @desc "Restrict to this reviewer's public reference."
    field(:reviewer_ref, :id)
    @desc "Match this requested community slug."
    field(:slug, :string)
    @desc "Lower bound on submission time."
    field(:submitted_from, :datetime)
    @desc "Upper bound on submission time."
    field(:submitted_to, :datetime)
  end

  object :trashed_article do
    @desc "Opaque ID of the trash membership."
    field(:id, non_null(:id), resolve: fn item, _, _ -> {:ok, item.hash_id} end)
    @desc "Thread of the removed article."
    field(:thread, non_null(:thread))
    @desc "Stable ID of the removed article."
    field(:article_id, non_null(:id))
    @desc "Article projection when available."
    field(:article, :article)
    @desc "Account responsible for removal."
    field(:deleted_by, :user, resolve: dataloader(CMS, :deleted_by))
    @desc "When the article entered trash."
    field(:deleted_at, non_null(:datetime))
    @desc "Command associated with the removal."
    field(:command_id, :id, resolve: &GroupherServerWeb.Resolvers.CMS.CommandPayload.command_id/3)

    @desc "Time scheduled for permanent deletion of the trash action."
    field(:scheduled_permanent_deletion_at, non_null(:datetime),
      resolve: fn item, _, _ -> {:ok, item.trash_action.scheduled_permanent_deletion_at} end
    )
  end

  object :trash_page do
    @desc "Article trash memberships on this page."
    field(:entries, non_null(list_of(non_null(:trashed_article))))
    pagi_fields()
  end

  object :activity_resource_ref do
    @desc "Kind of resource in the activity record."
    field(:type, non_null(:string), resolve: fn ref, _, _ -> {:ok, to_string(ref.type)} end)
    @desc "Reference identifying the resource."
    field(:ref, :id)
    @desc "Display title recorded for the resource."
    field(:title, :string)
    @desc "Community-local number, when applicable."
    field(:inner_id, :id)
    @desc "Navigation URL for the resource."
    field(:url, :string)
  end

  object :article_log_actor do
    @desc "Kind of actor responsible for the action."
    field(:type, non_null(:string), resolve: fn actor, _, _ -> {:ok, to_string(actor.type)} end)
    @desc "ID of the actor, when available."
    field(:id, :id)
    @desc "Actor's account login."
    field(:login, :string)
    @desc "Actor's display nickname."
    field(:nickname, :string)
    @desc "Actor's avatar URL."
    field(:avatar, :string)
  end

  object :article_log do
    @desc "ID of the article log entry."
    field(:id, non_null(:id))
    @desc "Recorded article operation."
    field(:action, non_null(:string), resolve: fn log, _, _ -> {:ok, to_string(log.action)} end)
    @desc "Actor that performed the action."
    field(:actor, non_null(:article_log_actor))
    @desc "Resource the action concerns."
    field(:subject, non_null(:activity_resource_ref))
    @desc "Related destination or target, when applicable."
    field(:target, :activity_resource_ref)
    @desc "Details specific to the action."
    field(:payload, non_null(:json))
    @desc "When the operation occurred."
    field(:occurred_at, non_null(:datetime))
  end

  object :article_log_page do
    @desc "Article history entries on this page."
    field(:entries, non_null(list_of(non_null(:article_log))))
    pagi_fields()
  end

  object :community_activity_event do
    @desc "ID of the stored event."
    field(:id, non_null(:id))
    @desc "Public reference for this event."
    field(:event_ref, :id, resolve: fn event, _, _ -> {:ok, uuid_ref(event.event_ref)} end)

    @desc "Reference shared by events from the same operation."
    field(:operation_ref, :id,
      resolve: fn event, _, _ -> {:ok, uuid_ref(event.operation_ref)} end
    )

    @desc "Reference of the event that caused this one."
    field(:parent_event_ref, :id,
      resolve: fn event, _, _ -> {:ok, uuid_ref(event.parent_event_ref)} end
    )

    @desc "Translation key for the event message."
    field(:message_key, non_null(:string))

    @desc "Parent event, when included."
    field(:parent_event, :community_activity_event)

    @desc "Related events caused by this event."
    field(:child_events, non_null(list_of(non_null(:community_activity_event))))

    @desc "Action that was attempted."
    field(:action, non_null(:string),
      resolve: fn event, _, _ -> {:ok, to_string(event.action)} end
    )

    @desc "Classification of the recorded action."
    field(:category, non_null(:string),
      resolve: fn event, _, _ -> {:ok, to_string(event.category)} end
    )

    @desc "Whether the action is classified as high risk."
    field(:high_risk, non_null(:boolean))

    @desc "Result of the attempted action."
    field(:outcome, non_null(:string),
      resolve: fn event, _, _ -> {:ok, to_string(event.outcome)} end
    )

    @desc "Machine-readable reason for rejection."
    field(:rejection_code, :string)
    @desc "Names of fields changed by the action."
    field(:changed_fields, non_null(list_of(non_null(:string))))
    @desc "Event position within the operation."
    field(:operation_index, non_null(:integer))
    @desc "Sequence assigned when recording the event."
    field(:record_sequence, non_null(:integer))

    @desc "Resource stream to which the event belongs."
    field(:resource, non_null(:activity_resource_ref))
    @desc "Actor that performed the action."
    field(:actor, non_null(:article_log_actor))
    @desc "Actor represented by the caller, when applicable."
    field(:on_behalf_of, :article_log_actor)
    @desc "Resource the event concerns."
    field(:subject, non_null(:activity_resource_ref))
    @desc "Related target of the action, when applicable."
    field(:target, :activity_resource_ref)

    @desc "Origin of the recorded operation."
    field(:source, non_null(:string),
      resolve: fn event, _, _ -> {:ok, to_string(event.source)} end
    )

    @desc "Action-specific evidence."
    field(:payload, non_null(:json))
    @desc "Additional context recorded with the event."
    field(:metadata, non_null(:json))
    @desc "When the action occurred."
    field(:occurred_at, non_null(:datetime))
    @desc "When the event was written."
    field(:recorded_at, non_null(:datetime))
  end

  object :community_activity_page do
    @desc "Activity events selected for this page."
    field(:entries, non_null(list_of(non_null(:community_activity_event))))
    @desc "Effective filter, preset and coverage for this query."
    field(:query_context, non_null(:community_activity_query_context))
    @desc "Pagination boundaries for the event list."
    field(:page_info, non_null(:page_info))
  end

  object :community_activity_bucket do
    @desc "Beginning of the reporting interval."
    field(:started_at, non_null(:datetime))
    @desc "End of the reporting interval."
    field(:ended_at, non_null(:datetime))
    @desc "Number of matching events in the interval."
    field(:count, non_null(:integer))
  end

  object :community_activity_stats do
    @desc "Time unit used to group events."
    field(:granularity, non_null(:string),
      resolve: fn stats, _, _ -> {:ok, to_string(stats.granularity)} end
    )

    @desc "Time zone used for bucket boundaries."
    field(:timezone, non_null(:string))
    @desc "Number of matching events across the range."
    field(:total_count, non_null(:integer))
    @desc "Event counts by time interval."
    field(:buckets, non_null(list_of(non_null(:community_activity_bucket))))
    @desc "Effective filters and coverage used for the counts."
    field(:query_context, non_null(:community_activity_query_context))
  end

  object :community_activity_action do
    @desc "Action identifier used in event filters."
    field(:action, non_null(:string), resolve: fn item, _, _ -> {:ok, to_string(item.action)} end)

    @desc "Translation key for the action label."
    field(:message_key, non_null(:string))

    @desc "Category used to group the action."
    field(:category, non_null(:string),
      resolve: fn item, _, _ -> {:ok, to_string(item.category)} end
    )

    @desc "Whether the action is classified as high risk."
    field(:high_risk, non_null(:boolean))
  end

  object :community_activity_resource_config do
    @desc "Kind of resource emitting activity."
    field(:resource_type, non_null(:string),
      resolve: fn item, _, _ -> {:ok, to_string(item.resource_type)} end
    )

    @desc "Actions available for this resource type."
    field(:actions, non_null(list_of(non_null(:community_activity_action))))
  end

  object :community_activity_config do
    @desc "Resource types and their supported actions."
    field(:resources, non_null(list_of(non_null(:community_activity_resource_config))))

    @desc "Recognized event origins."
    field(:sources, non_null(list_of(non_null(:string))),
      resolve: fn config, _, _ -> {:ok, Enum.map(config.sources, &to_string/1)} end
    )

    @desc "Recognized kinds of activity actors."
    field(:actor_types, non_null(list_of(non_null(:string))),
      resolve: fn config, _, _ -> {:ok, Enum.map(config.actor_types, &to_string/1)} end
    )

    @desc "Available named activity selections."
    field(:presets, non_null(list_of(non_null(:community_activity_preset_descriptor))))
  end

  enum :community_activity_relative_time_unit do
    @desc "Measure the lookback in days."
    value(:day)
    @desc "Measure the lookback in weeks."
    value(:week)
    @desc "Measure the lookback in months."
    value(:month)
  end

  object :community_activity_default_time_range do
    @desc "Number of units in the preset's lookback."
    field(:amount, non_null(:integer))
    @desc "Unit used for the lookback."
    field(:unit, non_null(:community_activity_relative_time_unit))
  end

  object :community_activity_preset_descriptor do
    @desc "Key used to select the preset."
    field(:key, non_null(:string))
    @desc "Translation key for the question this preset answers."
    field(:question_key, non_null(:string))
    @desc "Translation key for the preset explanation."
    field(:description_key, non_null(:string))
    @desc "Translation key describing limits of coverage."
    field(:coverage_note_key, :string)
    @desc "Default lookback when selecting the preset."
    field(:default_time_range, non_null(:community_activity_default_time_range))
  end

  object :community_activity_applied_preset do
    @desc "Key of the selected preset."
    field(:key, non_null(:string))
    @desc "Translation key for the selected question."
    field(:question_key, non_null(:string))
  end

  object :community_activity_query_context do
    @desc "Preset applied to this query, if any."
    field(:preset, :community_activity_applied_preset)
    @desc "Effective filter after applying the selection."
    field(:applied_filter, non_null(:json))
    @desc "Coverage information for the selected activity."
    field(:coverage, non_null(:json))
    @desc "Whether the requested filter and preset have no overlap."
    field(:preset_intersection_empty, non_null(:boolean))
  end

  object :community_activity_export do
    @desc "Serialized activity export."
    field(:content, non_null(:string))
    @desc "Suggested download filename."
    field(:filename, non_null(:string))
    @desc "Media type of the export."
    field(:mime_type, non_null(:string))
    @desc "Number of matching events."
    field(:total_count, non_null(:integer))
    @desc "Number of events included in the export."
    field(:exported_count, non_null(:integer))
    @desc "Metadata describing this export."
    field(:manifest, non_null(:json))
    @desc "Effective selection and coverage used for the export."
    field(:query_context, non_null(:community_activity_query_context))
  end

  defp uuid_ref(nil), do: nil

  defp uuid_ref(value) when is_binary(value) and byte_size(value) == 16 do
    case Ecto.UUID.load(value) do
      {:ok, ref} -> ref
      :error -> value
    end
  end

  defp uuid_ref(value), do: value

  enum :doc_tree_node_type do
    @desc "Top-level navigation tab."
    value(:tab)
    @desc "Group of navigation entries."
    value(:group)
    @desc "Page linked to a Doc."
    value(:page)
    @desc "Navigation link."
    value(:link)
    @desc "Pinned navigation entry."
    value(:pin)
  end

  enum :article_stage do
    @desc "Select draft content."
    value(:draft)
    @desc "Select the public version."
    value(:public)
  end

  enum :doc_publish_mode do
    @desc "Publish the Doc and synchronize its cover."
    value(:with_cover_sync)
    @desc "Publish the Doc without synchronizing its cover."
    value(:doc_only)
  end

  enum :doc_publish_status do
    @desc "Doc is in draft."
    value(:draft)
    @desc "Doc has a public version."
    value(:public)
  end

  enum :doc_cover_view do
    @desc "Cover as seen by public readers."
    value(:public)
    @desc "Cover as seen from the dashboard."
    value(:dashboard)
  end

  enum :community_asset_type do
    @desc "An image asset."
    value(:image)
    @desc "A video asset."
    value(:video)
    @desc "An audio asset."
    value(:audio)
    @desc "A general file attachment."
    value(:file)
  end

  enum :asset_thread do
    @desc "Asset associated with posts."
    value(:post)
    @desc "Asset associated with blog articles."
    value(:blog)
    @desc "Asset associated with changelogs."
    value(:changelog)
    @desc "Asset associated with Docs."
    value(:doc)
    @desc "Asset associated with tickets."
    value(:ticket)
  end

  enum :community_asset_status do
    @desc "Asset is active in the library."
    value(:active)
    @desc "Asset is marked deleted."
    value(:deleted)
  end

  enum :article_document_asset_usage do
    @desc "Image or file used inline in the document."
    value(:inline)
    @desc "Article cover image."
    value(:cover)
    @desc "Alternate article cover for dark mode."
    value(:cover_dark)
    @desc "File attached to the document."
    value(:attachment)
    @desc "Media embedded in the document."
    value(:embed)
  end

  enum :marker_type do
    @desc "Render a named icon."
    value(:icon)
    @desc "Render an emoji."
    value(:emoji)
  end

  object :marker_theme_appearance do
    @desc "Foreground color of the marker."
    field(:color, :string, resolve: &resolve_marker_field(:color, &1, &2, &3))
    @desc "Background color behind the marker."
    field(:bg, :string, resolve: &resolve_marker_field(:bg, &1, &2, &3))
  end

  object :marker_appearance do
    @desc "Marker colors for light mode."
    field(
      :light,
      non_null(:marker_theme_appearance),
      resolve: &resolve_marker_field(:light, &1, &2, &3)
    )

    @desc "Marker colors for dark mode."
    field(
      :dark,
      non_null(:marker_theme_appearance),
      resolve: &resolve_marker_field(:dark, &1, &2, &3)
    )
  end

  object :marker do
    @desc "Whether to render an icon or emoji."
    field(:type, non_null(:marker_type), resolve: &resolve_marker_field(:type, &1, &2, &3))
    @desc "Icon or emoji provider identifier."
    field(:provider, :string, resolve: &resolve_marker_field(:provider, &1, &2, &3))
    @desc "Name identifying the marker in its provider."
    field(:name, :string, resolve: &resolve_marker_field(:name, &1, &2, &3))
    @desc "Image source for the marker."
    field(:src, :string, resolve: &resolve_marker_field(:src, &1, &2, &3))
    @desc "Unified code-point sequence for an emoji."
    field(:unified, :string, resolve: &resolve_marker_field(:unified, &1, &2, &3))

    @desc "Foreground and background colors for each theme."
    field(:appearance, :marker_appearance,
      resolve: &resolve_marker_field(:appearance, &1, &2, &3)
    )
  end

  input_object :marker_theme_appearance_input do
    @desc "Foreground color of the marker."
    field(:color, :string)
    @desc "Background color behind the marker."
    field(:bg, :string)
  end

  input_object :marker_appearance_input do
    @desc "Marker colors for light mode."
    field(:light, non_null(:marker_theme_appearance_input))
    @desc "Marker colors for dark mode."
    field(:dark, non_null(:marker_theme_appearance_input))
  end

  input_object :marker_input do
    @desc "Whether to render an icon or emoji."
    field(:type, non_null(:marker_type))
    @desc "Icon or emoji provider identifier."
    field(:provider, :string)
    @desc "Name identifying the marker in its provider."
    field(:name, :string)
    @desc "Image source for the marker."
    field(:src, :string)
    @desc "Unified code-point sequence for an emoji."
    field(:unified, :string)
    @desc "Foreground and background colors for each theme."
    field(:appearance, :marker_appearance_input)
  end

  object :doc_public_tree_node do
    @desc "Stable logical `node_id`; the physical database row id is not exposed."
    field(:id, :id)

    @desc "Direct parent's logical `node_id`; null only for root Tabs."
    field(:parent_node_id, :id)
    @desc "ID of the associated Doc, when present."
    field(:doc_id, :id)
    @desc "Navigation node kind."
    field(:type, :doc_tree_node_type)
    @desc "Published navigation label."
    field(:title, :string)
    @desc "Position among sibling nodes."
    field(:index, :integer)
    @desc "Navigation destination."
    field(:href, :string)
    @desc "Icon or emoji displayed beside the label."
    field(:marker, :marker)
    @desc "Badge text displayed beside the label."
    field(:badge, :string)
    @desc "Child groups under this node."
    field(:groups, list_of(:doc_public_tree_node))
    @desc "Page entries under this node."
    field(:pages, list_of(:doc_public_tree_node))
    @desc "Pinned entries under this node."
    field(:pins, list_of(:doc_public_tree_node))
  end

  object :doc_public_tree do
    @desc "Top-level tabs in the published navigation tree."
    field(:tabs, list_of(:doc_public_tree_node))
  end

  enum :docs_queue_tree_change_type do
    @desc "Create or update a published navigation node."
    value(:upsert)
    @desc "Remove a node from the published navigation."
    value(:delete)
  end

  object :docs_queue_article do
    @desc "Stable ID of the queued Doc."
    field(:article_id, non_null(:id))
    @desc "ID of its queued working copy."
    field(:working_copy_id, non_null(:id))
    @desc "Revision of the queued working copy."
    field(:revision, non_null(:integer))
    @desc "Title of the queued content."
    field(:title, non_null(:string))
  end

  object :docs_queue_tree_change do
    @desc "Logical ID of the affected node."
    field(:node_id, non_null(:id))
    @desc "Whether release will upsert or delete the node."
    field(:change_type, non_null(:docs_queue_tree_change_type))
    @desc "Intended node representation for the change."
    field(:target, :json)
  end

  object :docs_publish_queue do
    @desc "Revision identifying the current queue contents."
    field(:revision, non_null(:integer))
    @desc "Whether release requires queue approval."
    field(:approval_required, non_null(:boolean))
    @desc "Whether self-approval is permitted."
    field(:allow_self_approval, non_null(:boolean))
    @desc "Revision of the approval policy."
    field(:approval_policy_revision, non_null(:integer))
    @desc "Approval state of the current queue."
    field(:approval_status, :docs_queue_approval_status)
    @desc "Document copies included in the queue."
    field(:articles, non_null(list_of(non_null(:docs_queue_article))))
    @desc "Navigation changes included in the queue."
    field(:tree_changes, non_null(list_of(non_null(:docs_queue_tree_change))))
  end

  object :docs_queue_member_editor do
    field(:queue_revision, non_null(:integer))
    field(:working_copy, non_null(:article_working_copy))
  end

  enum :docs_queue_approval_status do
    @desc "No approval is currently in progress."
    value(:idle)
    @desc "Approval is outstanding."
    value(:pending)
    @desc "The current queue has been approved."
    value(:approved)
    @desc "Changes have invalidated a previous approval."
    value(:needs_reapproval)
  end

  object :docs_queue_release_result do
    @desc "ID of the new Docs release."
    field(:release_id, non_null(:id))
    @desc "Queue revision after releasing."
    field(:queue_revision, non_null(:integer))
  end

  input_object :docs_queue_entry_input do
    @desc "Stable ID of the Doc to enqueue."
    field(:article_id, non_null(:id))
    @desc "Expected revision of its default working copy."
    field(:default_revision, non_null(:integer))
  end

  object :docs_queue_enqueue_result do
    @desc "Revision of the Docs publish queue."
    field(:queue_revision, non_null(:integer))
  end

  object :docs_queue_save_result do
    @desc "Revision of the Docs publish queue."
    field(:queue_revision, non_null(:integer))
    @desc "Revision of the editable content."
    field(:working_copy_revision, non_null(:integer))
  end

  object :docs_queue_approval_result do
    @desc "ID of the recorded approval."
    field(:approval_id, non_null(:id))
    @desc "Queue revision associated with the approval."
    field(:queue_revision, non_null(:integer))
  end

  enum :docs_merge_field do
    @desc "Document headline."
    value(:title)
    @desc "Content summary."
    value(:digest)
    @desc "URL slug."
    value(:slug)
    @desc "Document subtitle."
    value(:subtitle)
    @desc "Source link address."
    value(:link_addr)
    @desc "Document template identifier."
    value(:template_key)
    @desc "Default cover image URL."
    value(:cover_url)
    @desc "Dark-mode cover image URL."
    value(:cover_url_dark)
    @desc "Rich-text document body."
    value(:body)
    @desc "Assigned document tags."
    value(:tags)
    @desc "Editable cover composition."
    value(:cover_edit)
    @desc "References to community assets."
    value(:asset_refs)
  end

  enum :docs_merge_side do
    @desc "Keep the field from the incoming version."
    value(:source)
    @desc "Keep the field from the destination version."
    value(:target)
  end

  input_object :docs_merge_choice_input do
    @desc "Conflicting content field to resolve."
    field(:field, non_null(:docs_merge_field))
    @desc "Version from which to keep the field."
    field(:side, non_null(:docs_merge_side))
  end

  object :docs_queue_merge_conflict do
    @desc "Fields requiring an explicit merge choice."
    field(:fields, non_null(list_of(non_null(:docs_merge_field))))
    @desc "Queue revision at conflict detection."
    field(:queue_revision, non_null(:integer))
    @desc "Default working-copy revision at conflict detection."
    field(:default_revision, non_null(:integer))
    @desc "Queued working-copy revision at conflict detection."
    field(:working_copy_revision, non_null(:integer))
  end

  object :docs_queue_merge_result do
    @desc "Queue revision after a successful merge."
    field(:queue_revision, :integer)
    @desc "Queued copy revision after a successful merge."
    field(:working_copy_revision, :integer)
    @desc "Conflicts that prevented the merge."
    field(:conflict, :docs_queue_merge_conflict)
  end

  object :docs_post_publish_conflict do
    @desc "Published snapshot that must be reconciled."
    field(:public_snapshot_id, non_null(:id))
    @desc "Editable copy requiring reconciliation."
    field(:working_copy_id, non_null(:id))
    @desc "Revision of the default copy at conflict detection."
    field(:default_revision, non_null(:integer))
  end

  object :docs_post_publish_resolution do
    @desc "Working-copy revision after resolution."
    field(:working_copy_revision, :integer)
    @desc "Fields still requiring a resolution choice."
    field(:conflict_fields, list_of(non_null(:docs_merge_field)))
  end

  object :docs_discard_document do
    @desc "Doc whose queued edits would be lost."
    field(:article_id, non_null(:id))
    @desc "Fields with changes exclusive to the queued copy."
    field(:exclusive_fields, non_null(list_of(non_null(:string))))
  end

  object :docs_dequeue_preview do
    @desc "Whether discarding queued changes needs confirmation."
    field(:requires_confirmation, non_null(:boolean))
    @desc "Token to return when confirming the previewed discard."
    field(:confirmation, :docs_discard_confirmation)
    @desc "Docs with queue-only changes that would be lost."
    field(:documents, non_null(list_of(non_null(:docs_discard_document))))
  end

  object :docs_workspace_delete_preview do
    @desc "Whether deletion needs explicit confirmation."
    field(:requires_confirmation, non_null(:boolean))
    @desc "Token to return when confirming the previewed deletion."
    field(:confirmation, :docs_discard_confirmation)
    @desc "Docs with queue-only changes that would be lost."
    field(:documents, non_null(list_of(non_null(:docs_discard_document))))
    @desc "Number of public entries affected."
    field(:public_count, non_null(:integer))
    @desc "Number of draft entries affected."
    field(:draft_count, non_null(:integer))
  end

  object :docs_workspace_delete_result do
    @desc "ID of the trash action for the removed subtree."
    field(:trash_action_id, non_null(:id))
    @desc "Workspace tree revision after deletion."
    field(:tree_revision, non_null(:integer))
    @desc "Publish queue revision after deletion."
    field(:queue_revision, non_null(:integer))
  end

  object :docs_workspace_restore_result do
    @desc "Logical ID of the restored node."
    field(:node_id, non_null(:id))
    @desc "Workspace tree revision after restoration."
    field(:tree_revision, non_null(:integer))
    @desc "Publish queue revision after restoration."
    field(:queue_revision, non_null(:integer))
  end

  object :docs_discard_confirmation do
    @desc "Version of the confirmation format."
    field(:format_version, non_null(:integer))
    @desc "Fingerprint binding confirmation to the previewed discard."
    field(:hash, non_null(:string))
  end

  input_object :docs_discard_confirmation_input do
    @desc "Version of the confirmation format."
    field(:format_version, non_null(:integer))
    @desc "Fingerprint binding confirmation to the previewed discard."
    field(:hash, non_null(:string))
  end

  input_object :docs_workspace_node_patch_input do
    @desc "Replacement navigation label."
    field(:title, :string)
    @desc "Replacement link destination."
    field(:href, :string)
    @desc "New icon or emoji for the node."
    field(:marker, :marker_input)
    @desc "New badge text."
    field(:badge, :string)
    @desc "Whether to hide the node from navigation."
    field(:hidden, :boolean)
  end

  object :docs_workspace_node_result do
    @desc "Logical ID of the resulting node."
    field(:node_id, non_null(:id))
    @desc "ID of the associated article, if any."
    field(:article_id, :id)
    @desc "ID of the associated editable copy, if any."
    field(:working_copy_id, :id)
    @desc "Workspace tree revision after the operation."
    field(:tree_revision, non_null(:integer))
  end

  object :docs_workspace_update_result do
    @desc "Revision of the Docs workspace navigation tree."
    field(:tree_revision, non_null(:integer))
  end

  input_object :docs_workspace_node_input do
    @desc "Kind of navigation node to create."
    field(:type, non_null(:doc_tree_node_type))
    @desc "Label to display in navigation."
    field(:title, non_null(:string))
    @desc "Requested position among siblings."
    field(:index, :integer)
    @desc "Link destination."
    field(:href, :string)
    @desc "Icon or emoji beside the label."
    field(:marker, :marker_input)
    @desc "Badge text beside the label."
    field(:badge, :string)
    @desc "Whether to hide the node from navigation."
    field(:hidden, :boolean)
  end

  object :docs_workspace_node do
    @desc "Logical navigation node ID."
    field(:node_id, non_null(:id))
    @desc "Kind of navigation entry."
    field(:type, non_null(:doc_tree_node_type))
    @desc "Logical ID of the parent, if any."
    field(:parent_node_id, :id)
    @desc "Position among sibling nodes."
    field(:index, non_null(:integer))
    @desc "Editable navigation label."
    field(:title, non_null(:string))
    @desc "Link destination."
    field(:href, :string)
    @desc "ID of the associated Doc, when present."
    field(:doc_id, :id)
    @desc "Icon or emoji configuration."
    field(:marker, :json)
    @desc "Badge text beside the label."
    field(:badge, :string)
    @desc "Whether the node is hidden from navigation."
    field(:hidden, non_null(:boolean))
    @desc "Whether the node has been published."
    field(:published, non_null(:boolean))
    @desc "ID of the associated editable copy."
    field(:working_copy_id, :id)
    @desc "Revision of the associated editable copy."
    field(:working_copy_revision, :integer)
  end

  object :docs_editor do
    @desc "Editable version of the Doc, when present."
    field(:working_copy, :article_working_copy)
    @desc "Snapshot currently selected for publication, when present."
    field(:public_snapshot, :article_snapshot)
  end

  object :docs_begin_edit_result do
    @desc "Working copy selected for editing."
    field(:working_copy_id, non_null(:id))
    @desc "Revision to use for the next edit."
    field(:revision, non_null(:integer))
  end

  object :docs_workspace_tree do
    @desc "Revision of the editable navigation tree."
    field(:tree_revision, non_null(:integer))
    @desc "Revision of the associated publish queue."
    field(:queue_revision, non_null(:integer))
    @desc "Workspace nodes with their logical parent IDs."
    field(:nodes, non_null(list_of(non_null(:docs_workspace_node))))
  end

  object :comment_mutation_article do
    @desc "Community-local number of the affected article."
    field(:inner_id, non_null(:integer))
    @desc "Revision of its comment state after the mutation."
    field(:comments_revision, non_null(:integer))
  end

  object :comment_reconcile_entry do
    @desc "Requested article-local comment number."
    field(:comment_inner_id, non_null(:id))
    @desc "Current comment projection, if available."
    field(:comment, :comment)
  end

  object :comment_reconcile_payload do
    @desc "Article identity and comment revision for this batch."
    field(:article, non_null(:comment_mutation_article))
    @desc "Current projections keyed by the requested comment numbers."
    field(:entries, non_null(list_of(non_null(:comment_reconcile_entry))))
  end

  object :doc_cover do
    @desc "Navigation cards displayed on the Docs cover."
    field(:cards, non_null(list_of(non_null(:doc_cover_card))))
    @desc "Published Docs pinned to the cover."
    field(:pinned_docs, non_null(list_of(non_null(:doc_cover_pinned_doc))))
  end

  object :doc_cover_card do
    @desc "ID of the cover card."
    field(:id, non_null(:id))
    @desc "Logical ID of the group backing this card."
    field(:group_node_id, non_null(:id))
    @desc "Card position on the Docs cover."
    field(:index, non_null(:integer))
    @desc "Saved display settings for this card."
    field(:appearance, non_null(:json))
    @desc "Card's navigation heading."
    field(:title, non_null(:string))
    @desc "Navigation items shown in the card."
    field(:items, non_null(list_of(non_null(:doc_cover_card_item))))
  end

  object :doc_cover_card_item do
    @desc "Identifier of this cover entry."
    field(:id, non_null(:id))
    @desc "Logical ID of its navigation node."
    field(:node_id, non_null(:id))
    @desc "Position within the card."
    field(:index, non_null(:integer))
    @desc "Associated Doc ID, when present."
    field(:doc_id, :id)
    @desc "Kind of underlying navigation node."
    field(:type, non_null(:doc_tree_node_type))
    @desc "Label displayed on the card."
    field(:title, non_null(:string))
    @desc "Destination opened by the entry."
    field(:href, non_null(:string))
    @desc "Icon or emoji beside the label."
    field(:marker, :marker)
    @desc "Badge text beside the label."
    field(:badge, :string)
    @desc "Number of descendant leaves, when applicable."
    field(:leaf_count, :integer)
  end

  object :doc_cover_pinned_doc do
    @desc "Logical ID of the pinned page node."
    field(:node_id, non_null(:id))
    @desc "Position among pinned Docs."
    field(:index, non_null(:integer))
    @desc "Saved display settings for the pin."
    field(:appearance, non_null(:json))
    @desc "Destination opened by the pin."
    field(:href, non_null(:string))
    @desc "Published Doc shown in the pin."
    field(:doc, non_null(:doc))
  end

  object :article_working_copy do
    @desc "ID of this editable copy."
    field(:id, non_null(:id))
    @desc "Stable article ID, independent of its community route."
    field(:article_id, non_null(:id))

    @desc "Kind of scope that owns the editable copy."
    field(:scope_type, non_null(:string),
      resolve: fn work, _, _ -> {:ok, to_string(work.scope_type)} end
    )

    @desc "ID of the scope that owns the copy."
    field(:scope_id, non_null(:id))
    @desc "Current edit revision used to detect stale writes."
    field(:revision, non_null(:integer))
    @desc "Working headline."
    field(:title, non_null(:string))
    @desc "Working summary."
    field(:digest, non_null(:string))
    @desc "Route slug on this copy."
    field(:slug, :string)

    @desc "Rich-text document serialized as JSON."
    field(:body_json, non_null(:string),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).json}
      end
    )

    @desc "Markdown representation of the article body."
    field(:body_markdown, non_null(:string),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).markdown}
      end
    )

    @desc "HTML rendering of the article body."
    field(:body_html, non_null(:string),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).html}
      end
    )

    @desc "Table of contents derived from the article body."
    field(:body_markdown_toc, non_null(:json),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).markdown_toc}
      end
    )

    @desc "Article text without rich-text formatting."
    field(:body_plain_text, non_null(:string),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).plain_text}
      end
    )

    @desc "Thumbnail metadata derived from the article body."
    field(:body_thumbnail, non_null(:json),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).thumbnail}
      end
    )

    @desc "ID of the editable cover composition."
    field(:cover_edit_working_copy_id, :id)

    @desc "IDs of the tags attached to this article version."
    field(:tag_ids, non_null(list_of(non_null(:id))),
      resolve: fn work, _, _ -> CMS.articles_working_copy_tag_ids(work) end
    )

    @desc "Additional article fields specific to its thread."
    field(:thread_fields, non_null(:json),
      resolve: fn result, _, _ ->
        work = Map.get(result, :working_copy, result)
        CMS.articles_working_copy_thread_fields(work)
      end
    )

    @desc "Account that created the copy."
    field(:created_by_id, non_null(:id))
    @desc "Account that last changed the copy."
    field(:updated_by_id, non_null(:id))
    @desc "When the copy was created."
    field(:inserted_at, non_null(:datetime))
    @desc "When the copy was last changed."
    field(:updated_at, non_null(:datetime))
  end

  object :article_snapshot do
    @desc "ID of this immutable article version."
    field(:id, non_null(:id))
    @desc "Stable article ID, independent of its community route."
    field(:article_id, non_null(:id))
    @desc "Editable copy from which this snapshot was taken."
    field(:source_working_copy_id, non_null(:id))
    @desc "Revision captured from the source copy."
    field(:source_revision, non_null(:integer))
    @desc "Headline at capture."
    field(:title, non_null(:string))
    @desc "Summary at capture."
    field(:digest, non_null(:string))
    @desc "Route slug at capture."
    field(:slug, :string)

    @desc "Rich-text document serialized as JSON."
    field(:body_json, non_null(:string),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).json}
      end
    )

    @desc "Markdown representation of the article body."
    field(:body_markdown, non_null(:string),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).markdown}
      end
    )

    @desc "HTML rendering of the article body."
    field(:body_html, non_null(:string),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).html}
      end
    )

    @desc "Table of contents derived from the article body."
    field(:body_markdown_toc, non_null(:json),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).markdown_toc}
      end
    )

    @desc "Article text without rich-text formatting."
    field(:body_plain_text, non_null(:string),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).plain_text}
      end
    )

    @desc "Thumbnail metadata derived from the article body."
    field(:body_thumbnail, non_null(:json),
      resolve: fn owner, _, _ ->
        {:ok, CMS.articles_body_document(owner).thumbnail}
      end
    )

    @desc "ID of the captured cover composition."
    field(:cover_edit_snapshot_id, :id)

    @desc "IDs of the tags attached to this article version."
    field(:tag_ids, non_null(list_of(non_null(:id))),
      resolve: fn snapshot, _, _ -> CMS.articles_snapshot_tag_ids(snapshot) end
    )

    @desc "Additional article fields specific to its thread."
    field(:thread_fields, non_null(:json),
      resolve: fn snapshot, _, _ -> CMS.articles_snapshot_thread_fields(snapshot) end
    )

    @desc "Account that captured this version."
    field(:captured_by_id, non_null(:id))
    @desc "When this version was captured."
    field(:captured_at, non_null(:datetime))
  end

  object :article_public_snapshot do
    @desc "Stable article ID, independent of its community route."
    field(:article_id, non_null(:id))
    @desc "ID of the immutable article snapshot."
    field(:snapshot_id, non_null(:id))
    @desc "When this version was published."
    field(:published_at, non_null(:datetime))
    @desc "Account that published this version."
    field(:published_by_id, non_null(:id))
    @desc "Published headline."
    field(:title, non_null(:string))
    @desc "Published summary."
    field(:digest, non_null(:string))
    @desc "Published route slug."
    field(:slug, :string)
    @desc "Published article text without formatting."
    field(:plain_text, non_null(:string))
    @desc "Thumbnail metadata for the published body."
    field(:thumbnail, non_null(:json))
  end

  input_object :article_working_copy_source_input do
    @desc "ID when sourcing an editable copy."
    field(:working_copy_id, :id)
    @desc "Expected revision of the source working copy."
    field(:revision, :integer)
    @desc "ID when sourcing an immutable snapshot."
    field(:snapshot_id, :id)
  end

  object :article_working_copy_result do
    @desc "Editable copy returned by the operation."
    field(:working_copy, non_null(:article_working_copy),
      resolve: fn result, _, _ -> {:ok, Map.fetch!(result, :working_copy)} end
    )
  end

  object :dsb_theme_preset_option do
    @desc "Preset identifier used in layout settings."
    field(:value, non_null(:dsb_theme_preset))
    @desc "Design tokens resolved for this preset."
    field(:tokens, non_null(:json))
  end

  ######
  # common stands for minimal info of the type
  # used for small identity projections such as feeds
  object :participant_snapshot_user do
    @desc "Public reference encoded from the participant snapshot."
    field(:ref, non_null(:id),
      resolve: fn member, _, _ ->
        GroupherServer.CMS.snapshot_member_ref_encode(member)
      end
    )

    @desc "Login recorded for the participant."
    field(:login, non_null(:string))
    @desc "Avatar URL recorded for the participant."
    field(:avatar, :string)
    @desc "Nickname recorded for the participant."
    field(:nickname, :string)
  end

  object :common_user do
    @desc "Account login used in profile routes."
    field(:login, non_null(:string))
    @desc "URL of the account's avatar."
    field(:avatar, :string)
    @desc "Account display nickname."
    field(:nickname, :string)
    @desc "Profile biography."
    field(:bio, :string)
    @desc "Short profile introduction."
    field(:shortbio, :string)
  end

  object :common_article do
    @desc "Article thread."
    field(:thread, :thread)
    @desc "Article number within the community."
    field(:inner_id, :id)
    @desc "Community containing the article."
    field(:community, :community)
    @desc "Article headline."
    field(:title, :string)
    @desc "Revision of the article's comment state."
    field(:comments_revision, :integer)
    @desc "Article counts and their revisions."
    field(:article_stats, :article_stats)

    @desc "Account that authored the article."
    field(:author, :common_user,
      resolve: fn source, args, resolution ->
        GroupherServerWeb.Schema.Helper.Fields.article_relation(
          source,
          args,
          resolution,
          :author
        )
      end
    )
  end

  object :common_comment do
    @desc "Comment number within the article."
    field(:inner_id, :id, resolve: &R.CMS.Comments.comment_inner_id/3)

    @desc "Canonical rich content of the comment."
    field(:body, non_null(:artiment_body),
      resolve: &GroupherServerWeb.Schema.Helper.Fields.comment_body/3
    )

    @desc "Number of upvotes on the comment."
    field(:upvotes_count, :integer)
    @desc "Account that authored the comment."
    field(:author, :common_user)
    @desc "Article containing the comment."
    field(:article, :common_article)
  end

  ######

  object :idlike do
    @desc "Identifier of the resource returned by the operation."
    field(:id, :id)
  end

  object :community_asset do
    @desc "ID of the community asset record."
    field(:id, :id)
    @desc "Stable public reference distinct from the record ID."
    field(:public_ref, :string)
    @desc "Content thread associated with the asset."
    field(:thread, :asset_thread)
    @desc "Media category of the file."
    field(:asset_type, :community_asset_type)
    @desc "Whether the asset is active or deleted."
    field(:status, :community_asset_status)
    @desc "Display title of the asset."
    field(:title, :string)
    @desc "Name of the uploaded file."
    field(:filename, :string)
    @desc "Internet media type of the file."
    field(:mime_type, :string)
    @desc "URL used to access the file."
    field(:url, :string)
    @desc "Storage provider holding the uploaded object."
    field(:storage, :string)
    @desc "Key locating the object within its storage provider."
    field(:storage_key, :string)
    @desc "Fingerprint of the stored content."
    field(:content_hash, :string)
    @desc "Encoded file size in bytes."
    field(:size_bytes, :big_int)
    @desc "Image width in pixels."
    field(:width, :integer)
    @desc "Image height in pixels."
    field(:height, :integer)
    @desc "Additional media metadata."
    field(:meta, :json)
    @desc "When the asset was marked deleted."
    field(:deleted_at, :datetime)
    @desc "Community that owns the asset."
    field(:community, :community, resolve: dataloader(CMS, :community))
    @desc "Account that uploaded the file."
    field(:uploader, :user, resolve: dataloader(CMS, :uploader))

    timestamp_fields()
  end

  object :article_asset_ref do
    @desc "ID of this asset reference, distinct from the asset ID."
    field(:id, :id)
    @desc "Thread of the referencing article."
    field(:thread, :asset_thread)
    @desc "Stable article ID, independent of its community route."
    field(:article_id, :id)
    @desc "Role of the asset in the document."
    field(:usage, :article_document_asset_usage)
    @desc "Identifier of the referencing editor block."
    field(:block_id, :string)
    @desc "Kind of editor block containing the reference."
    field(:block_type, :string)
    @desc "Position of the reference in the document."
    field(:position, :integer)
    @desc "Title attached to this reference."
    field(:title, :string)
    @desc "Alternative text for this occurrence."
    field(:alt, :string)
    @desc "Source recorded for this occurrence."
    field(:source, :string)
    @desc "Additional reference-specific metadata."
    field(:meta, :json)
    @desc "Community asset used by this occurrence."
    field(:asset, :community_asset, resolve: dataloader(CMS, :asset))

    timestamp_fields()
  end

  object :community_asset_usage do
    @desc "Number of assets counted toward usage."
    field(:asset_count, :integer)
    @desc "Storage used by these assets, in bytes."
    field(:storage_bytes, :big_int)
  end

  object :community_asset_thread_stat do
    @desc "Content thread for this group."
    field(:thread, non_null(:asset_thread))
    @desc "Number of assets in this thread."
    field(:count, non_null(:integer))
  end

  object :community_asset_subtype_stat do
    @desc "Stable key used to identify this option."
    field(:key, non_null(:string))
    @desc "Display label for the subtype."
    field(:label, non_null(:string))
    @desc "Number of matching assets in this subtype."
    field(:count, non_null(:integer))
  end

  object :community_asset_type_stat do
    @desc "Media category for this group."
    field(:asset_type, non_null(:community_asset_type))
    @desc "Number of matching assets in the category."
    field(:count, non_null(:integer))
    @desc "Counts broken down by subtype."
    field(:subtypes, non_null(list_of(non_null(:community_asset_subtype_stat))))
  end

  object :community_asset_stats do
    @desc "Total assets counted."
    field(:total_count, non_null(:integer))
    @desc "Bytes of storage in use."
    field(:storage_bytes, non_null(:big_int))
    @desc "Community storage quota in bytes."
    field(:storage_limit_bytes, non_null(:big_int))
    @desc "Asset counts grouped by content thread."
    field(:by_thread, non_null(list_of(non_null(:community_asset_thread_stat))))
    @desc "Asset counts grouped by media category."
    field(:by_asset_type, non_null(list_of(non_null(:community_asset_type_stat))))
  end

  object :community_asset_origin_info do
    @desc "Public asset reference used for origin lookup."
    field(:public_ref, non_null(:string))
    @desc "Whether the asset is active or deleted."
    field(:status, non_null(:community_asset_status))
    @desc "When the asset was marked deleted."
    field(:deleted_at, :datetime)
    @desc "Name of the uploaded file."
    field(:filename, :string)
    @desc "Storage provider holding the uploaded object."
    field(:storage, :string)
    @desc "Key locating the object within its storage provider."
    field(:storage_key, :string)
    @desc "Internet media type of the file."
    field(:mime_type, :string)
    @desc "Encoded file size in bytes."
    field(:size_bytes, :big_int)
    @desc "Image width in pixels."
    field(:width, :integer)
    @desc "Image height in pixels."
    field(:height, :integer)
    @desc "Additional metadata recorded for the stored object."
    field(:meta, :json)
  end

  input_object :community_asset_input do
    @desc "Content thread associated with the asset."
    field(:thread, :asset_thread)
    @desc "Media category of the asset."
    field(:asset_type, :community_asset_type)
    @desc "Display title for the asset."
    field(:title, :string)
    @desc "Name of the uploaded file."
    field(:filename, :string)
    @desc "Internet media type of the file."
    field(:mime_type, :string)
    @desc "URL of the referenced file."
    field(:url, non_null(:string))
    @desc "Storage provider holding the uploaded object."
    field(:storage, :string)
    @desc "Key locating the object within its storage provider."
    field(:storage_key, :string)
    @desc "Fingerprint of the stored content."
    field(:content_hash, :string)
    @desc "Encoded file size in bytes."
    field(:size_bytes, non_null(:big_int))
    @desc "Image width in pixels."
    field(:width, :integer)
    @desc "Image height in pixels."
    field(:height, :integer)
    @desc "Additional media metadata."
    field(:meta, :json)
  end

  object :community_asset_upload_intent do
    @desc "Public reference used to identify the upload."
    field(:upload_ref, non_null(:string))
    @desc "Stable public reference of the community asset."
    field(:asset_public_ref, non_null(:string))
    @desc "Destination key assigned to the upload."
    field(:object_key, non_null(:string))
    @desc "Authorization token scoped to this upload."
    field(:capability, non_null(:string))
    @desc "When the upload authorization expires."
    field(:expires_at, non_null(:datetime))
    @desc "Largest file size accepted by this upload intent, in bytes."
    field(:max_size_bytes, non_null(:big_int))
    @desc "Media types accepted by this upload intent."
    field(:allowed_mime_types, non_null(list_of(non_null(:string))))
  end

  input_object :community_asset_upload_file_input do
    @desc "Name of the uploaded file."
    field(:filename, non_null(:string))
    @desc "Internet media type of the file."
    field(:mime_type, non_null(:string))
    @desc "Encoded file size in bytes."
    field(:size_bytes, non_null(:big_int))
    @desc "SHA-256 checksum of the file, when supplied."
    field(:checksum_sha256, :string)
    @desc "Content thread associated with the upload."
    field(:thread, :asset_thread)
    @desc "Media category of the uploaded file."
    field(:asset_type, :community_asset_type)
  end

  input_object :community_asset_filter do
    @desc "Search text for the asset library."
    field(:query, :string)
    @desc "Restrict assets to this content thread."
    field(:thread, :asset_thread)
    @desc "Restrict assets to this media category."
    field(:asset_type, :community_asset_type)
    @desc "Restrict results to these media subtypes."
    field(:subtypes, list_of(non_null(:string)))
  end

  input_object :community_asset_upload_completion_input do
    @desc "Public reference used to identify the upload."
    field(:upload_ref, non_null(:string))
    @desc "Key identifying retries of the same completion."
    field(:idempotency_key, non_null(:string))
    @desc "ID of the community that owns the upload."
    field(:community_id, non_null(:id))
    @desc "Account that uploaded the file."
    field(:uploader_id, :id)
    @desc "Stable public reference of the community asset."
    field(:asset_public_ref, non_null(:string))
    @desc "URL of the stored file."
    field(:url, non_null(:string))
    @desc "Storage provider holding the uploaded object."
    field(:storage, non_null(:string))
    @desc "Key locating the object within its storage provider."
    field(:storage_key, non_null(:string))
    @desc "Fingerprint of the stored content."
    field(:content_hash, non_null(:string))
    @desc "Encoded file size in bytes."
    field(:size_bytes, non_null(:big_int))
    @desc "Name of the uploaded file."
    field(:filename, :string)
    @desc "Internet media type of the file."
    field(:mime_type, :string)
    @desc "Content thread associated with the asset."
    field(:thread, :asset_thread)
    @desc "Media category of the stored file."
    field(:asset_type, :community_asset_type)
    @desc "Image width in pixels."
    field(:width, :integer)
    @desc "Image height in pixels."
    field(:height, :integer)
    @desc "Additional metadata for the finalized asset."
    field(:meta, :json)
  end

  input_object :article_asset_ref_input do
    @desc "ID of the referenced community asset."
    field(:asset_id, :id)
    @desc "Asset details supplied with the reference."
    field(:asset, :community_asset_input)
    @desc "Role of the asset in the article."
    field(:usage, :article_document_asset_usage)
    @desc "Identifier of the referencing editor block."
    field(:block_id, :string)
    @desc "Kind of block containing the reference."
    field(:block_type, :string)
    @desc "Position of this reference in the document."
    field(:position, :integer)
    @desc "Title for this occurrence."
    field(:title, :string)
    @desc "Alternative text for this occurrence."
    field(:alt, :string)
    @desc "Source recorded for this occurrence."
    field(:source, :string)
    @desc "Additional metadata specific to the reference."
    field(:meta, :json)
  end

  input_object :artiment_toc_item_input do
    @desc "Heading identifier used for navigation."
    field(:id, non_null(:string))
    @desc "Heading depth in the document."
    field(:level, non_null(:integer))
    @desc "Text displayed for the heading."
    field(:title, non_null(:string))
  end

  object :artiment_toc_item do
    @desc "Heading identifier used for navigation."
    field(:id, non_null(:string),
      resolve: fn item, _, _ -> {:ok, Map.get(item, :id) || Map.get(item, "id")} end
    )

    @desc "Heading depth in the document."
    field(:level, non_null(:integer),
      resolve: fn item, _, _ -> {:ok, Map.get(item, :level) || Map.get(item, "level")} end
    )

    @desc "Text displayed for the heading."
    field(:title, non_null(:string),
      resolve: fn item, _, _ -> {:ok, Map.get(item, :title) || Map.get(item, "title")} end
    )
  end

  input_object :artiment_body_bag_input do
    @desc "Canonical rich-text document serialized as JSON."
    field(:json, non_null(:string))
    @desc "Markdown representation of the document."
    field(:markdown, non_null(:string))
    @desc "Rendered HTML representation."
    field(:html, non_null(:string))
    @desc "Heading entries in document order."
    field(:toc, non_null(list_of(non_null(:artiment_toc_item_input))))
    @desc "Body text without formatting."
    field(:plain_text, non_null(:string))
    @desc "Short content summary."
    field(:digest, non_null(:string))
    @desc "Fingerprint of the canonical body."
    field(:body_hash, non_null(:string))
    @desc "Version of the body document format."
    field(:schema_version, non_null(:integer))
    @desc "Thumbnail metadata derived from the document."
    field(:thumbnail, non_null(:json))
  end

  object :artiment_body do
    @desc "Canonical rich-text document serialized as JSON."
    field(:json, non_null(:string))
    @desc "Markdown representation of the document."
    field(:markdown, non_null(:string))

    @desc "Heading entries in document order."
    field(:toc, non_null(list_of(non_null(:artiment_toc_item))),
      resolve: fn body, _, _ ->
        case body.markdown_toc do
          %{items: items} when is_list(items) -> {:ok, items}
          %{"items" => items} when is_list(items) -> {:ok, items}
          items when is_list(items) -> {:ok, items}
          _ -> {:ok, []}
        end
      end
    )

    @desc "Rendered HTML representation."
    field(:html, non_null(:string))
    @desc "Body text without formatting."
    field(:plain_text, non_null(:string))
    @desc "Short content summary."
    field(:digest, non_null(:string))
    @desc "Fingerprint of the canonical body, when available."
    field(:body_hash, :string)
    @desc "Version of the body document format."
    field(:schema_version, non_null(:integer))
    @desc "Thumbnail metadata derived from the document."
    field(:thumbnail, non_null(:json))
  end

  object :post do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    comments_fields()

    @desc "Post category, including question posts."
    field(:cat, :article_cat_enum)
    @desc "Whether a solution has been accepted."
    field(:is_solved, non_null(:boolean))
    @desc "ID of the accepted solution comment."
    field(:solution_comment_id, :id)
    @desc "Summary of the accepted solution."
    field(:solution_digest, :string)

    timestamp_fields(:article)
  end

  object :changelog do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    comments_fields()

    timestamp_fields(:article)
  end

  object :doc do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    @desc "Subtitle displayed beneath the Doc headline."
    field(:subtitle, :string)
    comments_fields()

    timestamp_fields(:article)
  end

  object :blog do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    comments_fields()

    timestamp_fields(:article)
  end

  object :contribute do
    meta(:cache, max_age: 30)
    @desc "UTC calendar date of the contributions."
    field(:date, :date)
    @desc "Number of contributions on this date."
    field(:count, :integer)
  end

  object :contribute_map do
    meta(:cache, max_age: 30)
    @desc "First date in the contribution range."
    field(:start_date, :date)
    @desc "Last date in the contribution range."
    field(:end_date, :date)
    @desc "Total contributions across the range."
    field(:total_count, :integer)
    @desc "Daily contribution counts."
    field(:records, list_of(:contribute))
  end

  object(:dsb_rss, do: dsb_gq_fields(:rss))
  object(:dsb_seo, do: dsb_gq_fields(:seo))
  object(:dsb_bg_config, do: dsb_gq_fields(:wallpaper_bg))

  object :cover_background do
    @desc "ID of the stored cover background."
    field(:id, :id)
    dsb_gq_fields(:wallpaper_bg)
  end

  object :cover_config do
    @desc "ID of the selected background."
    field(:background_id, :id)
    @desc "ID of the original background before editing."
    field(:original_background_id, :id)

    @desc "Selected background loaded by its stored ID."
    field :background, :cover_background do
      resolve(dataloader(CMS, &cover_background_loader(:background_id, &1, &2, &3)))
    end

    @desc "Original background loaded by its stored ID."
    field :original_background, :cover_background do
      resolve(dataloader(CMS, &cover_background_loader(:original_background_id, &1, &2, &3)))
    end

    @desc "Image layers used in the cover composition."
    field(:images, list_of(:json))
  end

  object :cover_edit_info do
    @desc "ID of the saved cover composition."
    field(:id, :id)
    @desc "Cover canvas width in pixels."
    field(:canvas_width, :integer)
    @desc "Cover canvas height in pixels."
    field(:canvas_height, :integer)
    @desc "Version of the cover composition format."
    field(:format_version, :integer)
    @desc "Cover composition for light mode."
    field(:light, :cover_config)
    @desc "Cover composition for dark mode."
    field(:dark, :cover_config)

    timestamp_fields()
  end

  input_object :cover_background_input do
    dsb_input_fields(:wallpaper_bg)
  end

  input_object :cover_config_input do
    @desc "ID of the selected background."
    field(:background_id, :id)
    @desc "Settings of the selected background."
    field(:background, :cover_background_input)
    @desc "ID of the original background before editing."
    field(:original_background_id, :id)
    @desc "Original background settings."
    field(:original_background, :cover_background_input)
    @desc "Image layers used in the cover composition."
    field(:images, list_of(:json))
  end

  input_object :cover_edit_info_input do
    @desc "Cover canvas width in pixels."
    field(:canvas_width, non_null(:integer))
    @desc "Cover canvas height in pixels."
    field(:canvas_height, non_null(:integer))
    @desc "Version of the submitted cover format."
    field(:format_version, :integer)
    @desc "Composition to use in light mode."
    field(:light, non_null(:cover_config_input))
    @desc "Composition to use in dark mode."
    field(:dark, non_null(:cover_config_input))
  end

  object :custom_wallpaper do
    @desc "Kind of custom wallpaper to render."
    field(:type, non_null(:custom_wallpaper_type))
    @desc "Public reference of the source image asset."
    field(:asset_public_ref, :string)
    @desc "Custom settings for the selected wallpaper kind."
    field(:config, non_null(:json))
  end

  object :wallpaper_settings do
    @desc "Format version of the wallpaper settings."
    field(:settings_schema_version, non_null(:integer))
    @desc "Wallpaper source mode."
    field(:type, non_null(:wallpaper_type))
    @desc "Selected wallpaper source."
    field(:source, :string)
    @desc "Custom gradient or picture settings."
    field(:custom_wallpaper, :custom_wallpaper)
    @desc "Parameters used to render the wallpaper."
    field(:render_config, :json)
  end

  object :wallpaper_settings_by_theme do
    @desc "Saved wallpaper settings for light mode."
    field(:light, non_null(:wallpaper_settings))
    @desc "Saved wallpaper settings for dark mode."
    field(:dark, non_null(:wallpaper_settings))
  end

  object :wallpaper_image do
    @desc "URL of the rendered wallpaper image."
    field(:url, non_null(:string))
    @desc "Image width in pixels."
    field(:width, non_null(:integer))
    @desc "Image height in pixels."
    field(:height, non_null(:integer))
  end

  object :wallpaper_images do
    @desc "Rendition for wide screens."
    field(:wide, non_null(:wallpaper_image))
    @desc "Rendition for desktop screens."
    field(:desktop, non_null(:wallpaper_image))
    @desc "Rendition for tablets."
    field(:tablet, non_null(:wallpaper_image))
    @desc "Rendition for phones."
    field(:phone, non_null(:wallpaper_image))
  end

  object :wallpaper do
    @desc "Current published wallpaper version."
    field(:version, non_null(:integer))
    @desc "Published light-mode renditions."
    field(:light, :wallpaper_images)
    @desc "Published dark-mode renditions."
    field(:dark, :wallpaper_images)
    @desc "Wallpaper source for light mode."
    field(:light_source, :string)
    @desc "Wallpaper source for dark mode."
    field(:dark_source, :string)
  end

  object :wallpaper_snapshot do
    @desc "ID used to restore this saved wallpaper."
    field(:id, non_null(:id))
    @desc "Theme to which this snapshot belongs."
    field(:theme, non_null(:wallpaper_theme))
    @desc "Settings captured in the snapshot."
    field(:settings, non_null(:wallpaper_settings))
    @desc "When the wallpaper settings were saved."
    field(:saved_at, non_null(:datetime))
    @desc "Whether this is the active snapshot for its theme."
    field(:active, non_null(:boolean))
  end

  object :wallpaper_publish_result do
    @desc "Wallpaper version after publication."
    field(:version, non_null(:integer))
  end

  object :wallpaper_upload_preparation do
    @desc "Reference for the prepared image batch."
    field(:batch_ref, non_null(:string))
    @desc "Authorization token for this image batch."
    field(:batch_capability, non_null(:string))
    @desc "When the prepared authorization expires."
    field(:expires_at, non_null(:datetime))
    @desc "Per-profile authorizations for the generated images."
    field(:upload_intents, non_null(list_of(non_null(:wallpaper_upload_intent))))
  end

  object :wallpaper_upload_intent do
    @desc "Screen profile for this generated image."
    field(:profile, non_null(:wallpaper_profile))
    @desc "Authorization token for uploading this rendition."
    field(:capability, non_null(:string))
    @desc "Public reference used to identify the upload."
    field(:upload_ref, non_null(:string))
  end

  object :dsb_layout do
    dsb_gq_fields(:layout, except: [:custom_theme_preset])

    @desc "Base preset used by the current custom theme preset."
    field :theme_preset_base, :dsb_theme_preset do
      resolve(fn layout, _, _ ->
        # `themePresetBase` describes the saved Custom preset only. Returning
        # nil when Custom has not been created lets clients distinguish that
        # state from "Custom exists and is based on DEFAULT".
        if is_map(layout.custom_theme_preset) do
          {:ok, ThemePreset.custom_base_preset(layout.custom_theme_preset)}
        else
          {:ok, nil}
        end
      end)
    end

    @desc "Resolved design tokens for the active theme preset."
    field :theme_tokens, :json do
      resolve(fn layout, _, _ ->
        tokens =
          ThemePreset.resolve(
            layout.theme_preset,
            layout.custom_theme_preset
          )

        {:ok, tokens}
      end)
    end

    @desc "Theme preset options available for dashboard layout settings."
    field :theme_presets, list_of(:dsb_theme_preset_option) do
      resolve(fn layout, _, _ ->
        {:ok, ThemePreset.options(layout.custom_theme_preset)}
      end)
    end
  end

  object(:dsb_enable, do: dsb_gq_fields(:enable))

  object :dsb_thread_emotions do
    @desc "Reactions available on posts."
    field(:post, list_of(:emotion_type))
    @desc "Reactions available on blog articles."
    field(:blog, list_of(:emotion_type))
    @desc "Reactions available on changelogs."
    field(:changelog, list_of(:emotion_type))
    @desc "Reactions available on Docs."
    field(:doc, list_of(:emotion_type))
    @desc "Reactions available on post comments."
    field(:post_comment, list_of(:emotion_type))
    @desc "Reactions available on blog comments."
    field(:blog_comment, list_of(:emotion_type))
    @desc "Reactions available on changelog comments."
    field(:changelog_comment, list_of(:emotion_type))
    @desc "Reactions available on Doc comments."
    field(:doc_comment, list_of(:emotion_type))
  end

  object(:dsb_base_info, do: dsb_gq_fields(:base_info))
  object(:dsb_name_alias, do: dsb_gq_fields(:name_alias))

  object :dsb_link_child do
    @desc "Navigation item identifier."
    field(:id, :string)
    @desc "Label shown for the link."
    field(:title, :string)
    @desc "Destination URL."
    field(:url, :string)
  end

  object :dsb_link do
    @desc "Navigation item identifier."
    field(:id, :string)
    @desc "Whether this item is a link or a group."
    field(:type, :dsb_link_type)
    @desc "Label shown in navigation."
    field(:title, :string)
    @desc "Destination for a single link."
    field(:url, :string)
    @desc "Child destinations for a link group."
    field(:links, list_of(:dsb_link_child))
  end

  object(:dsb_social_link, do: dsb_gq_fields(:social_link))
  object(:dsb_media_report, do: dsb_gq_fields(:media_report))

  object :dsb_third_party_analytics_provider_field do
    @desc "Stable key used to identify this option."
    field(:key, :string)
    @desc "Display label for this setting."
    field(:label, :string)
    @desc "Explanation of the setting."
    field(:desc, :string)
    @desc "Example value shown before input."
    field(:placeholder, :string)
    @desc "Whether a value is mandatory when the integration is enabled."
    field(:required_when_enabled, :boolean)
    @desc "Validation pattern for the setting."
    field(:pattern, :string)
  end

  object :dsb_third_party_analytics_provider do
    @desc "Integration provider identifier."
    field(:provider, :string)
    @desc "Provider display name."
    field(:title, :string)
    @desc "Short description of the integration."
    field(:desc, :string)
    @desc "Additional provider information."
    field(:detail, :string)
    @desc "Provider documentation URL."
    field(:docs_url, :string)
    @desc "Icon identifying the provider."
    field(:icon, :string)
    @desc "Configuration key identifying the tracked property."
    field(:identity_field, :string)
    @desc "Settings accepted by the provider."
    field(:config_fields, list_of(:dsb_third_party_analytics_provider_field))
  end

  object :dsb_third_party_analytics do
    @desc "Analytics provider identifier."
    field(:provider, :string)
    @desc "Whether the integration is switched on."
    field(:enabled, :boolean)
    @desc "Provider-issued measurement identifier."
    field(:measurement_id, :string)
    @desc "Provider-issued tracking container identifier."
    field(:container_id, :string)
    @desc "Provider-issued project identifier."
    field(:project_id, :string)
    @desc "Domain registered for tracking."
    field(:domain, :string)
    @desc "Provider-issued site identifier."
    field(:site_id, :string)
  end

  input_object :dsb_third_party_analytics_input do
    @desc "Analytics provider identifier."
    field(:provider, :string)
    @desc "Whether the integration is switched on."
    field(:enabled, :boolean)
    @desc "Provider-issued measurement identifier."
    field(:measurement_id, :string)
    @desc "Provider-issued tracking container identifier."
    field(:container_id, :string)
    @desc "Provider-issued project identifier."
    field(:project_id, :string)
    @desc "Domain registered for tracking."
    field(:domain, :string)
    @desc "Provider-issued site identifier."
    field(:site_id, :string)
  end

  object :dsb_doc_faq_item do
    @desc "ID identifying the FAQ entry."
    field(:id, :id)
    @desc "Question shown to readers."
    field(:title, :string)
    @desc "Answer displayed for the question."
    field(:detail, :string)
    @desc "Display position among sibling items."
    field(:index, :integer)
  end

  object :dsb_doc_faq_group do
    @desc "ID identifying the FAQ group."
    field(:id, :id)
    @desc "Heading shown above the group's questions."
    field(:title, :string)
    @desc "Display position among sibling items."
    field(:index, :integer)
    @desc "FAQ entries in this group."
    field(:items, list_of(:dsb_doc_faq_item))
  end

  object :dsb_doc_faq do
    @desc "Heading of the FAQ section."
    field(:title, :string)
    @desc "Introductory text for the FAQ."
    field(:desc, :string)
    @desc "Whether to show questions in groups."
    field(:grouped_view, :boolean)
    @desc "Question groups for the grouped view."
    field(:group_items, list_of(:dsb_doc_faq_group))
    @desc "Question entries for the ungrouped view."
    field(:flat_items, list_of(:dsb_doc_faq_item))
  end

  input_object :dsb_doc_faq_item_input do
    @desc "ID identifying the FAQ entry."
    field(:id, :string)
    @desc "Question shown to readers."
    field(:title, :string)
    @desc "Answer displayed for the question."
    field(:detail, :string)
    @desc "Display position among sibling items."
    field(:index, :integer)
  end

  input_object :dsb_doc_faq_group_input do
    @desc "ID identifying the FAQ group."
    field(:id, :string)
    @desc "Heading shown above the group's questions."
    field(:title, :string)
    @desc "Display position among sibling items."
    field(:index, :integer)
    @desc "FAQ entries in this group."
    field(:items, list_of(:dsb_doc_faq_item_input))
  end

  input_object :dsb_doc_faq_input do
    @desc "Heading of the FAQ section."
    field(:title, :string)
    @desc "Introductory text for the FAQ."
    field(:desc, :string)
    @desc "Whether to show questions in groups."
    field(:grouped_view, :boolean)
    @desc "Question groups for the grouped view."
    field(:group_items, list_of(:dsb_doc_faq_group_input))
    @desc "Question entries for the ungrouped view."
    field(:flat_items, list_of(:dsb_doc_faq_item_input))
  end

  object :dsb do
    @desc "Search engine metadata settings."
    field(:seo, :dsb_seo)

    @desc "Published wallpaper renditions for the community."
    field(:wallpaper, non_null(:wallpaper)) do
      resolve(fn dashboard, _, _ ->
        {:ok, CMS.wallpaper_wallpaper(dashboard.community_id)}
      end)
    end

    @desc "Editable wallpaper settings by theme."
    field(:wallpaper_settings, non_null(:wallpaper_settings_by_theme)) do
      resolve(fn dashboard, _, _ ->
        {:ok, CMS.wallpaper_wallpaper_settings(dashboard.community_id)}
      end)
    end

    @desc "Whether community content surfaces use a shadow."
    field(:content_shadow, non_null(:boolean))

    @desc "Community-wide list interaction preference."
    field(:pagi_mode, non_null(:pagi_mode))
    @desc "List interaction preference on mobile."
    field(:pagi_mobile_mode, non_null(:pagi_mode))
    @desc "Revision of the pagination preferences."
    field(:pagi_revision, non_null(:integer))

    @desc "Retained wallpaper snapshots for the selected theme."
    field(:wallpaper_history, non_null(list_of(non_null(:wallpaper_snapshot)))) do
      arg(:theme, non_null(:wallpaper_theme))

      resolve(fn dashboard, %{theme: theme}, _ ->
        {:ok, CMS.wallpaper_wallpaper_history(dashboard.community_id, theme)}
      end)
    end

    @desc "Community layout and theme settings."
    field(:layout, :dsb_layout)
    @desc "Community feature switches."
    field(:enable, :dsb_enable)
    @desc "Allowed reactions for articles and comments by thread."
    field(:thread_emotions, :dsb_thread_emotions)
    @desc "Community profile settings."
    field(:base_info, :dsb_base_info)
    @desc "Community RSS settings."
    field(:rss, :dsb_rss)
    @desc "Custom display names for community features."
    field(:name_alias, list_of(:dsb_name_alias))
    @desc "Navigation items in the header."
    field(:header_links, list_of(:dsb_link))
    @desc "Navigation items in the footer."
    field(:footer_links, list_of(:dsb_link))
    @desc "Links in the compact footer row."
    field(:footer_oneline_links, list_of(:dsb_link_child))
    @desc "Community social profile links."
    field(:social_links, list_of(:dsb_social_link))
    @desc "Media coverage configured for the community."
    field(:media_reports, list_of(:dsb_media_report))
    @desc "Frequently asked questions shown in Docs."
    field(:doc_faq, :dsb_doc_faq)
    @desc "Configured external analytics integrations."
    field(:third_party_analytics, list_of(:dsb_third_party_analytics))
    @desc "Website identifier for built-in Umami tracking."
    field(:umami_website_id, :string)

    @desc "Enabled analytics configurations that passed provider validation."
    field :enabled_third_party_analytics, list_of(:dsb_third_party_analytics) do
      resolve(fn dashboard, _, _ ->
        {:ok, ThirdPartyAnalytics.enabled_valid_configs(dashboard.third_party_analytics)}
      end)
    end
  end

  object :community do
    meta(:cache, max_age: 30)
    @desc "Stable, immutable Community identity."
    field(:ref, non_null(:string))
    @desc "Community display title."
    field(:title, non_null(:string))
    @desc "Community introduction text."
    field(:desc, :string)
    @desc "Community slug used in API routes."
    field(:slug, non_null(:string))
    @desc "URL of the community favicon."
    field(:favicon, :string)
    @desc "Community homepage URL."
    field(:homepage, :string)
    @desc "Display position among sibling items."
    field(:index, :integer)
    @desc "Community logo image."
    field(:logo, :string)
    @desc "Community owner account."
    field(:author, :user, resolve: dataloader(CMS, :author))
    @desc "Community language setting."
    field(:locale, :string)
    @desc "Categories assigned to the community."
    field(:categories, list_of(:category), resolve: dataloader(CMS, :categories))
    @desc "Dashboard configuration for this community."
    field(:dashboard, :dsb, resolve: dataloader(CMS, :dashboard))

    @desc "Thread counts and application metadata."
    field(:meta, :community_meta)
    @desc "Recorded community views."
    field(:views, :integer)
    @desc "Contribution counts summarized from the community's daily records."
    field(:contributes_digest, list_of(:integer))

    @desc "Number of articles in the community."
    field(:articles_count, :integer)
    @desc "Number of community subscribers."
    field(:subscribers_count, :integer)
    field(:admins_count, :integer)

    @desc "Total number of tags configured for the community."
    field :community_tags_count, :integer do
      resolve(&R.CMS.Communities.community_tags_count/3)
    end

    @desc "Whether the current viewer has subscribed to this community."
    field(:viewer_has_subscribed, :boolean)
    @desc "Whether the current viewer is an Admin of this Community."
    field(:viewer_is_admin, :boolean)

    @desc "Current state from the community lifecycle record, when present."
    field(:lifecycle_state, :community_lifecycle_state,
      resolve: fn
        %{lifecycle: %{state: state}}, _, _ -> {:ok, state}
        _, _, _ -> {:ok, nil}
      end
    )

    @desc "Legacy numeric community status used when no lifecycle record exists."
    field(:pending, :integer)
    @desc "Identifier of the command that produced this result."
    field(:command_id, :id, resolve: &GroupherServerWeb.Resolvers.CMS.CommandPayload.command_id/3)

    timestamp_fields()
  end

  object :category do
    @desc "ID of the community category."
    field(:id, :id)
    @desc "Category display name."
    field(:title, :string)
    @desc "Route-friendly identifier for the category."
    field(:slug, :string)
    @desc "Display position among sibling items."
    field(:index, :integer)
    @desc "Account that created the category."
    field(:author, :user, resolve: dataloader(CMS, :author))

    timestamp_fields()
  end

  enum :article_thread do
    article_values()
  end

  object :community_tag do
    @desc "ID of the tag."
    field(:id, non_null(:id))
    @desc "Display name of the tag."
    field(:title, non_null(:string))
    @desc "Description shown for the tag."
    field(:desc, :string)
    @desc "Display layout associated with the tag."
    field(:layout, :string)
    @desc "Tag identifier used in routes and filters."
    field(:slug, non_null(:string))
    @desc "Palette color used for the tag."
    field(:color, non_null(:rainbow_color))
    @desc "Article thread in which this tag is available."
    field(:thread, non_null(:article_thread))
    @desc "Display title of the tag's group."
    field(:group, :string, resolve: &R.CMS.Communities.community_tag_group_title/3)
    @desc "ID of the group containing this tag."
    field(:group_id, :id)
    @desc "Additional string attributes stored for the tag."
    field(:extra, list_of(:string))
    @desc "Icon or emoji displayed beside the navigation label."
    field(:marker, :marker)
    @desc "Display position among sibling items."
    field(:index, :integer)

    @desc "Account that created the tag."
    field(:author, :user, resolve: dataloader(CMS, :author))
    @desc "Community that owns the tag."
    field(:community, :community, resolve: dataloader(CMS, :community))
    @desc "Content counts for this tag."
    field(:stats, :community_tag_stat, resolve: &R.CMS.Communities.community_tag_stats/3)

    timestamp_fields()
  end

  object :community_tag_group do
    @desc "ID of the tag group."
    field(:id, :id)
    @desc "Heading displayed for this tag group."
    field(:title, :string)
    @desc "Thread in which the group is available."
    field(:thread, :thread)
    @desc "Display position among sibling items."
    field(:index, :integer)
    @desc "Community tags belonging to this group."
    field(:tags, list_of(:community_tag), resolve: dataloader(CMS, :tags))

    @desc "Community that owns this group."
    field(:community, :community, resolve: dataloader(CMS, :community))

    timestamp_fields()
  end

  defp resolve_marker_field(field, marker, _args, _info) do
    {:ok, GroupherServer.CMS.marker_field(marker, field)}
  end

  object :community_tag_stat do
    @desc "Number of content items carrying this tag."
    field(:contents_count, :integer)
    @desc "Number of items counted for this tag today."
    field(:today_contents_count, :integer)
  end

  object :emotion_stat do
    @desc "Emotion being counted."
    field(:type, :emotion_type)
    @desc "Number of reactions of this type."
    field(:count, :integer)
    @desc "Whether the viewer added this reaction."
    field(:viewer_has_reacted, :boolean)
    @desc "Recent users who added this reaction."
    field(:latest_users, list_of(:common_user))
  end

  object :viewer_article_state do
    @desc "Community slug in the article path."
    field(:community, non_null(:string))
    @desc "Thread in the article path."
    field(:thread, non_null(:thread))
    @desc "Community-local article number."
    field(:inner_id, non_null(:id))
    @desc "Whether the viewer has recorded a read of this article."
    field(:viewer_has_viewed, :boolean)
  end

  @desc "Private, no-store Article interaction projection used to reconcile confirmed writes"
  object :article_interaction_state do
    @desc "Community slug in the article path."
    field(:community, non_null(:string))
    @desc "Thread in the article path."
    field(:thread, non_null(:thread))
    @desc "Community-local article number."
    field(:inner_id, non_null(:id))
    @desc "Revision of the article's reaction and collection state."
    field(:interaction_revision, non_null(:integer))
    @desc "Whether the viewer has upvoted the article."
    field(:viewer_has_upvoted, non_null(:boolean))
    @desc "Whether the viewer has saved the article to a collection."
    field(:viewer_has_collected, non_null(:boolean))
    @desc "Viewer's current emotion reaction, when present."
    field(:viewer_emotion, :emotion_type)
  end

  object :viewer_comment_emotion_state do
    @desc "Comment emotion being checked."
    field(:type, non_null(:emotion_type))
    @desc "Whether the viewer added this emotion."
    field(:viewer_has_reacted, :boolean)
  end

  object :viewer_comment_state do
    @desc "Comment number within its article."
    field(:inner_id, non_null(:id))
    @desc "Whether the viewer has upvoted the comment."
    field(:viewer_has_upvoted, :boolean)
    @desc "Viewer reaction flags by emotion."
    field(:emotions, non_null(list_of(non_null(:viewer_comment_emotion_state))))
  end

  object :comment_meta do
    @desc "Whether the article author upvoted the comment."
    field(:is_article_author_upvoted, :boolean)
    @desc "Whether the comment replies to another participant."
    field(:is_reply_to_others, :boolean)

    # field(:is_solution, :boolean)
  end

  object :comment_reply do
    comment_general_fields()
    @desc "Whether this reply is the accepted solution."
    field(:is_solution, :boolean)
  end

  object :comment do
    comment_general_fields()

    @desc "Reply previews for this comment."
    field(:replies, list_of(:comment_reply))
    @desc "Article containing the comment."
    field(:article, :common_article)

    @desc "Whether the comment belongs to a question."
    field(:is_for_question, :boolean)
    @desc "Whether this comment is the accepted solution."
    field(:is_solution, :boolean)
  end

  object :comments_list_state do
    @desc "Number of comments in the list."
    field(:total_count, :integer)
    @desc "Number of distinct participants."
    field(:participants_count, :integer)
    @desc "User snapshots for the participants returned."
    field(:participants, list_of(:participant_snapshot_user))
  end

  object :artiment_mention do
    @desc "ID of the stored mention."
    field(:id, non_null(:id))
    @desc "Content containing the mention."
    field(:source, non_null(:mentions_graph_node))
    @desc "Kind of content, account or URL mentioned."
    field(:target_type, non_null(:mention_type))
    @desc "Resolved destination of the mention."
    field(:target, non_null(:mention_target))
    @desc "Whether the mention is inline or a link."
    field(:mention_case, non_null(:mention_case))
    @desc "Number of matching occurrences in the source."
    field(:occurrences_count, non_null(:integer))
    @desc "When the mention was recorded."
    field(:mentioned_at, non_null(:datetime))
  end

  object :mention_user_target do
    @desc "Kind identifying an account mention."
    field(:type, non_null(:mention_type))
    @desc "Read availability of the account target."
    field(:status, non_null(:artiment_read_status))
    @desc "Account login used in profile routes."
    field(:login, :string)
    @desc "Name displayed for the mentioned account."
    field(:display_name, :string)
    @desc "Profile URL when available."
    field(:url, :string)
  end

  object :mention_url_target do
    @desc "Kind identifying an external URL mention."
    field(:type, non_null(:mention_type))
    @desc "External destination of the mention."
    field(:url, non_null(:string))
  end

  union :mention_target do
    types([:mentions_graph_node, :mention_user_target, :mention_url_target])

    resolve_type(fn
      %{__typename: :mention_user_target}, _ ->
        :mention_user_target

      %{__typename: :mention_url_target}, _ ->
        :mention_url_target

      %{type: type}, _ when type in [:post, :blog, :changelog, :doc, :ticket, :comment] ->
        :mentions_graph_node

      _, _ ->
        nil
    end)
  end

  object :blog_feed do
    @desc "Title from the feed entry."
    field(:title, :string)
    @desc "Summary from the feed entry."
    field(:digest, :string)
    @desc "URL of the original entry."
    field(:link_addr, :string)
    @desc "Content supplied by the feed."
    field(:content, :string)
    @desc "Publication timestamp from the feed."
    field(:published, :string)
    @desc "Update timestamp from the feed."
    field(:updated, :string)
  end

  object :blog_author do
    @desc "Name used in the blog byline."
    field(:name, :string)
    @desc "Biographical introduction."
    field(:intro, :string)
    @desc "GitHub identity listed by the author."
    field(:github, :string)
    @desc "Twitter identity listed by the author."
    field(:twitter, :string)
  end

  article_page_objects()

  @desc "Stable public offset/cursor page metadata."
  interface :page_info do
    @desc "Whether results precede this page."
    field(:has_previous_page, non_null(:boolean))
    @desc "Whether more results follow this page."
    field(:has_next_page, non_null(:boolean))

    resolve_type(fn
      %{api: :offset}, _ -> :offset_page_info
      %{api: :cursor}, _ -> :cursor_page_info
      %{__typename: "OffsetPageInfo"}, _ -> :offset_page_info
      %{__typename: "CursorPageInfo"}, _ -> :cursor_page_info
      _, _ -> nil
    end)
  end

  object :offset_page_info do
    interface(:page_info)
    @desc "Current page number, starting at one."
    field(:page, non_null(:integer))
    @desc "Maximum entries per page."
    field(:size, non_null(:integer))
    @desc "Total number of matching entries."
    field(:total_count, non_null(:integer))
    @desc "Number of pages at this page size."
    field(:total_pages, non_null(:integer))
    @desc "Whether results precede this page."
    field(:has_previous_page, non_null(:boolean))
    @desc "Whether more results follow this page."
    field(:has_next_page, non_null(:boolean))
  end

  object :cursor_page_info do
    interface(:page_info)
    @desc "Cursor identifying the start of this page."
    field(:start_cursor, :string)
    @desc "Continuation cursor for fetching the next page."
    field(:end_cursor, :string)
    @desc "Whether results precede this page."
    field(:has_previous_page, non_null(:boolean))
    @desc "Whether more results follow this page."
    field(:has_next_page, non_null(:boolean))
  end

  object :comment_page do
    @desc "Pinned comments returned separately from the regular page."
    field(:pinned_entries, non_null(list_of(non_null(:comment))))
    @desc "Regular comments on this page."
    field(:entries, non_null(list_of(non_null(:comment))))
    @desc "Pagination boundaries for the current result set."
    field(:page_info, non_null(:page_info))
  end

  object :artiment_mention_page do
    @desc "Revision of the returned mention list."
    field(:revision, non_null(:id))
    @desc "Stored mention relationships on this page."
    field(:entries, non_null(list_of(non_null(:artiment_mention))))

    @desc "Pagination boundaries for the current result set."
    field :page_info, non_null(:page_info) do
      resolve(fn %{page_info: page}, _, _ ->
        {:ok, Helper.ORM.Pagi.Page.info(page)}
      end)
    end
  end

  object :community_asset_page do
    @desc "Community assets matching the query on this page."
    field(:entries, list_of(:community_asset))
    pagi_fields()
  end

  object :article_asset_ref_page do
    @desc "Article references to the selected community asset on this page."
    field(:entries, list_of(:article_asset_ref))
    pagi_fields()
  end

  object :comment_collection_page do
    @desc "Collected comments on this page."
    field(:entries, list_of(:comment))
    pagi_fields()
  end

  object :comment_reply_page do
    @desc "Replies to the selected root comment on this page."
    field(:entries, non_null(list_of(non_null(:comment_reply))))
    @desc "Pagination boundaries for the current result set."
    field(:page_info, non_null(:page_info))
  end

  object :community_page do
    @desc "Communities returned on this page."
    field(:entries, non_null(list_of(non_null(:community))))
    pagi_fields()
  end

  object :article_collection_page do
    @desc "Collected articles on this page."
    field(:entries, list_of(:common_article))
    pagi_fields()
  end

  object :search_article_locator do
    @desc "Community slug in the search result route."
    field(:community, non_null(:string))
    @desc "Thread containing the indexed article."
    field(:thread, non_null(:thread))
    @desc "Community-local article number."
    field(:inner_id, non_null(:id))
  end

  object :search_comment_locator do
    @desc "Path to the containing article."
    field(:article, non_null(:search_article_locator))
    @desc "Number identifying the matched comment within the article."
    field(:inner_id, non_null(:id))
    @desc "Number of the root comment for a reply."
    field(:root_inner_id, :id)
  end

  object :article_search_artiment do
    @desc "Identifier of the indexed search document."
    field(:ref, non_null(:id))
    @desc "Kind identifying an article search result."
    field(:type, non_null(:search_artiment_type))
    @desc "Stable public reference of the community."
    field(:community_ref, non_null(:string))
    @desc "Thread of the indexed article."
    field(:thread, non_null(:thread))
    @desc "Stable article ID, independent of its community route."
    field(:article_id, non_null(:id))
    @desc "Snapshot from which this index entry was built."
    field(:indexed_snapshot_id, :id)
    @desc "Indexed article headline."
    field(:title, non_null(:string))
    @desc "Indexed article summary."
    field(:digest, :string)
    @desc "Path to the matching article."
    field(:locator, non_null(:search_article_locator))
    @desc "Public reference of the author."
    field(:author_ref, :string)
    @desc "Language recorded in the index."
    field(:locale, :string)
    @desc "Number of upvotes recorded for this content."
    field(:upvotes_count, non_null(:integer))
    @desc "Number of comments on the article."
    field(:comments_count, non_null(:integer))
    @desc "Publication time recorded in the index."
    field(:published_at, :datetime)
    @desc "Creation time recorded in the index."
    field(:inserted_at, non_null(:datetime))
    @desc "Last update time recorded in the index."
    field(:updated_at, non_null(:datetime))
    @desc "Version of the search document format."
    field(:schema_version, non_null(:integer))
  end

  object :comment_search_artiment do
    @desc "Identifier of the indexed search document."
    field(:ref, non_null(:id))
    @desc "Kind identifying a comment search result."
    field(:type, non_null(:search_artiment_type))
    @desc "Stable public reference of the community."
    field(:community_ref, non_null(:string))
    @desc "Thread of the containing article."
    field(:thread, non_null(:thread))
    @desc "Stable article ID, independent of its community route."
    field(:article_id, non_null(:id))
    @desc "Indexed comment excerpt."
    field(:digest, :string)
    @desc "Path to the matching comment."
    field(:locator, non_null(:search_comment_locator))
    @desc "Public reference of the author."
    field(:author_ref, :string)
    @desc "Language recorded in the index."
    field(:locale, :string)
    @desc "Number of upvotes recorded for this content."
    field(:upvotes_count, non_null(:integer))
    @desc "Number of replies recorded in the index."
    field(:replies_count, non_null(:integer))
    @desc "Creation time recorded in the index."
    field(:inserted_at, non_null(:datetime))
    @desc "Last update time recorded in the index."
    field(:updated_at, non_null(:datetime))
    @desc "Fingerprint of the stored content."
    field(:content_hash, non_null(:string))
    @desc "Version of the search document format."
    field(:schema_version, non_null(:integer))
  end

  union :search_artiment do
    types([:article_search_artiment, :comment_search_artiment])

    resolve_type(fn
      %{type: :article}, _ -> :article_search_artiment
      %{type: :comment}, _ -> :comment_search_artiment
    end)
  end

  enum :search_highlight_field do
    @desc "Match found in the article headline."
    value(:title)
    @desc "Match found in unformatted body text."
    value(:plain_text)
  end

  object :search_highlight do
    @desc "Indexed field containing the match."
    field(:field, non_null(:search_highlight_field))
    @desc "Matched text excerpts for this field."
    field(:fragments, non_null(list_of(non_null(:string))))
  end

  object :search_artiment_hit do
    @desc "Matching indexed article or comment."
    field(:artiment, non_null(:search_artiment))
    @desc "Text excerpts grouped by matched field."
    field(:highlights, non_null(list_of(non_null(:search_highlight))))
  end

  object :search_artiment_page do
    @desc "Ranked search hits on this page."
    field(:entries, non_null(list_of(non_null(:search_artiment_hit))))
    pagi_fields()
  end

  @desc "article meta info"
  object :article_meta do
    @desc "Thread to which the article belongs."
    field(:thread, :thread)
    @desc "Whether the article has been edited."
    field(:is_edited, :boolean)
    @desc "Whether new comments are locked."
    field(:is_comment_locked, :boolean)
    @desc "When activity was last recorded on the article."
    field(:last_active_at, :datetime)
    @desc "Recent users who upvoted the article."
    field(:latest_upvoted_users, list_of(:common_user))
  end

  object :community_meta do
    threads_count_fields()
    @desc "Message submitted with the community application."
    field(:apply_msg, :string)
    @desc "Category requested in the community application."
    field(:apply_category, :string)
  end

  object :open_graph do
    @desc "Title reported by the linked page."
    field(:title, :string)
    @desc "URL reported for the linked page."
    field(:url, :string)
    @desc "Favicon of the linked site."
    field(:favicon, :string)
    @desc "Name of the linked site."
    field(:site_name, :string)
  end

  object :client_locale do
    @desc "Language reported for the client."
    field(:locale, :string)
  end

  defp cover_background_loader(field, config, args, _resolution) do
    # CoverConfig is an embedded schema, so there is no Ecto association for
    # Absinthe to preload. Use the stored background id as the Dataloader item
    # key so light/dark cover backgrounds still batch through the CMS loader.
    %{batch: {CoverBackground, args}, item: Map.get(config, field)}
  end

  enum :docs_diff_baseline do
    @desc "Compare against the current published version."
    value(:public)
    @desc "Compare against the approval baseline."
    value(:approval)
  end
end
