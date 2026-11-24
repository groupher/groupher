defmodule GroupherServer.CMS.Tickets do
  @moduledoc """
  Public boundary for the dedicated Ticket read and command surfaces.

  `:ticket` remains outside ordinary Article operations. Callers enter here
  for Ticket queries, progress projections, and receipt-backed mutations.

      GraphQL or CMS caller
        -> Tickets facade
        -> Gate-scoped Query or receipt-backed Commands
  """

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Model.Community
  alias CMS.Tickets.{Commands, Query}
  alias Accounts.Model.User

  @doc "Pages public User Tickets for one Community."
  def page_public(%Community{} = community, filter \\ %{}, pagi \\ nil) do
    Query.page_public(community, filter, pagi)
  end

  @doc "Pages internal User Tickets after Community and Ticket Gate admission."
  def page_internal(%Community{} = community, %User{} = actor, filter \\ %{}, pagi \\ nil) do
    Query.page_internal(community, actor, filter, pagi)
  end

  @doc "Returns the public User Ticket selected by its Community number."
  def get_public(%Community{} = community, inner_id), do: Query.get_public(community, inner_id)

  @doc "Returns one internal Ticket after read_internal Gate admission."
  def get_internal(%Community{} = community, ticket_id, %User{} = actor) do
    Query.get_internal(community, ticket_id, actor)
  end

  @doc "Pages internal Activity for one Ticket after Ticket Gate admission."
  def activity_internal(%Community{} = community, ticket_id, %User{} = actor, pagi \\ nil) do
    Query.activity_internal(community, ticket_id, actor, pagi)
  end

  @doc "Returns enabled public Kanban columns from Ticket state."
  def grouped_public(%Community{} = community, pagi \\ nil) do
    Query.grouped_public(community, pagi)
  end

  @doc "Returns the internal User Ticket board after Ticket Gate admission."
  def grouped_internal(%Community{} = community, %User{} = actor, pagi \\ nil) do
    Query.grouped_internal(community, actor, pagi)
  end

  def grouped_internal(%Community{} = community, %User{} = actor, pagi, filter) do
    Query.grouped_internal(community, actor, pagi, filter)
  end

  @doc "Searches Ticket titles for actors with internal Ticket read permission."
  def search_internal(%Community{} = community, query, %User{} = actor, pagi \\ nil, type \\ nil) do
    Query.search_internal(community, query, actor, pagi, type)
  end

  @doc "Computes batched current public User Ticket progress for Post IDs."
  def post_progress(%Community{} = community, post_ids) do
    Query.post_progress(community, post_ids)
  end

  @doc "Returns current public target projections for a batch of Activity Ticket IDs."
  def public_activity_targets(%Community{} = community, ticket_ids) when is_list(ticket_ids) do
    Query.public_activity_targets(community, ticket_ids)
  end

  @doc "Returns all internally readable User Tickets linked to one Post."
  def linked_to_post_internal(%Community{} = community, post_id, %User{} = actor) do
    Query.linked_to_post_internal(community, post_id, actor)
  end

  @doc "Creates a public User Ticket from a public Post."
  def create_from_post(%Community{} = community, post_id, attrs, %User{} = actor, command_id) do
    Commands.CreateFromPost.execute(community, post_id, attrs, actor, command_id)
  end

  @doc "Creates a private Worker under a User Ticket."
  def create_worker(
        %Community{} = community,
        parent_id,
        attrs,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.CreateWorker.execute(
      community,
      parent_id,
      attrs,
      expected_version,
      actor,
      command_id
    )
  end

  @doc "Creates an internal Case Ticket."
  def create_case(%Community{} = community, attrs, %User{} = actor, command_id) do
    Commands.CreateCase.execute(community, attrs, actor, command_id)
  end

  @doc "Adds a User Ticket to a Case."
  def add_case_member(
        %Community{} = community,
        case_id,
        ticket_id,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.AddCaseMember.execute(
      community,
      case_id,
      ticket_id,
      expected_version,
      actor,
      command_id
    )
  end

  @doc "Removes a User Ticket from a Case."
  def remove_case_member(
        %Community{} = community,
        case_id,
        ticket_id,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.RemoveCaseMember.execute(
      community,
      case_id,
      ticket_id,
      expected_version,
      actor,
      command_id
    )
  end

  @doc "Links a parent-owned Worker as a Case's shared fix."
  def add_case_worker(
        %Community{} = community,
        case_id,
        worker_id,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.AddCaseWorker.execute(
      community,
      case_id,
      worker_id,
      expected_version,
      actor,
      command_id
    )
  end

  @doc "Replaces the users assigned to one Ticket."
  def set_assignees(
        %Community{} = community,
        ticket_id,
        user_ids,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.SetAssignees.execute(
      community,
      ticket_id,
      user_ids,
      expected_version,
      actor,
      command_id
    )
  end

  @doc "Replaces the internal Post tags assigned to one Ticket."
  def set_tags(
        %Community{} = community,
        ticket_id,
        tag_ids,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.SetTags.execute(community, ticket_id, tag_ids, expected_version, actor, command_id)
  end

  @doc "Replaces normalized version, operating system, and module facets."
  def set_facets(
        %Community{} = community,
        ticket_id,
        facets,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.SetFacets.execute(community, ticket_id, facets, expected_version, actor, command_id)
  end

  @doc "Moves a Ticket through its permitted work-state transitions."
  def transition(
        %Community{} = community,
        ticket_id,
        status,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.Transition.execute(community, ticket_id, status, expected_version, actor, command_id)
  end

  @doc "Moves a Ticket within or between work columns."
  def move_ticket(
        %Community{} = community,
        ticket_id,
        status,
        rank,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.Move.execute(community, ticket_id, status, rank, expected_version, actor, command_id)
  end

  @doc "Updates Ticket content, priority and planned dates."
  def update_ticket(
        %Community{} = community,
        ticket_id,
        attrs,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.Update.execute(community, ticket_id, attrs, expected_version, actor, command_id)
  end

  @doc "Appends an internal or public progress update."
  def add_update(
        %Community{} = community,
        ticket_id,
        body,
        visibility,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.AddUpdate.execute(
      community,
      ticket_id,
      body,
      visibility,
      nil,
      nil,
      expected_version,
      actor,
      command_id
    )
  end

  def add_update(
        %Community{} = community,
        ticket_id,
        body,
        visibility,
        supersedes_id,
        lifecycle_version,
        workflow_version,
        %User{} = actor,
        command_id
      ) do
    Commands.AddUpdate.execute(
      community,
      ticket_id,
      body,
      visibility,
      supersedes_id,
      lifecycle_version,
      workflow_version,
      actor,
      command_id
    )
  end

  def add_update(
        %Community{} = community,
        ticket_id,
        body,
        visibility,
        supersedes_id,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.AddUpdate.execute(
      community,
      ticket_id,
      body,
      visibility,
      supersedes_id,
      nil,
      expected_version,
      actor,
      command_id
    )
  end

  @doc "Ensures a shared Article Draft workspace for a published User Ticket."
  def ensure_draft(
        %Community{} = community,
        ticket_id,
        lifecycle_version,
        %User{} = actor,
        command_id
      ) do
    Commands.EnsureDraft.execute(community, ticket_id, lifecycle_version, actor, command_id)
  end

  @doc "Saves the current Ticket Draft using Draft and Lifecycle versions."
  def save_draft(
        %Community{} = community,
        ticket_id,
        attrs,
        draft_version,
        lifecycle_version,
        %User{} = actor,
        command_id
      ) do
    Commands.SaveDraft.execute(
      community,
      ticket_id,
      attrs,
      draft_version,
      lifecycle_version,
      actor,
      command_id
    )
  end

  @doc "Publishes a reviewed Ticket Draft using Draft, Lifecycle, and workflow versions."
  def publish(
        %Community{} = community,
        ticket_id,
        reason,
        draft_version,
        lifecycle_version,
        workflow_version,
        %User{} = actor,
        command_id,
        expected_preview
      ) do
    Commands.Publish.execute(
      community,
      ticket_id,
      reason,
      draft_version,
      lifecycle_version,
      workflow_version,
      actor,
      command_id,
      expected_preview
    )
  end

  @doc "Moves a published Ticket to Draft using its Article Lifecycle version."
  def move_to_draft(
        %Community{} = community,
        ticket_id,
        reason,
        lifecycle_version,
        %User{} = actor,
        command_id
      ) do
    Commands.MoveToDraft.execute(
      community,
      ticket_id,
      reason,
      lifecycle_version,
      actor,
      command_id
    )
  end

  @doc "Links a typed source to a User Ticket; the first release accepts POST."
  def link_source(
        %Community{} = community,
        ticket_id,
        type,
        source_id,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.LinkSource.execute(
      community,
      ticket_id,
      type,
      source_id,
      expected_version,
      actor,
      command_id
    )
  end

  @doc "Unlinks a source relation by its TicketSource identity."
  def unlink_source(
        %Community{} = community,
        ticket_id,
        source_id,
        expected_version,
        %User{} = actor,
        command_id
      ) do
    Commands.UnlinkSource.execute(
      community,
      ticket_id,
      source_id,
      expected_version,
      actor,
      command_id
    )
  end
end
