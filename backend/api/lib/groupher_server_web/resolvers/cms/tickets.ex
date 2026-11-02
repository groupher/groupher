defmodule GroupherServerWeb.Resolvers.CMS.Tickets do
  @moduledoc """
  Adapts GraphQL Ticket arguments and authenticated context to the CMS facade.

      GraphQL field arguments and context
        -> Ticket resolver
        -> CMS.Tickets query or command result
  """

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.Accounts.Model.User

  @doc "Resolves the public three-column Ticket Kanban."
  def grouped_public(_root, %{community: %Community{} = community} = args, _info) do
    CMS.tickets_grouped_public(community, Map.get(args, :pagi))
  end

  @doc "Resolves the internal three-column Ticket Kanban."
  def grouped_internal(_root, %{community: %Community{} = community} = args, %{
        context: %{cur_user: %User{} = actor}
      }) do
    CMS.tickets_grouped_internal(
      community,
      actor,
      Map.get(args, :pagi),
      Map.get(args, :filter) || %{}
    )
  end

  @doc "Resolves a public User Ticket page."
  def page_public(_root, %{community: %Community{} = community} = args, _info) do
    CMS.tickets_page_public(community, Map.get(args, :filter) || %{}, Map.get(args, :pagi))
  end

  @doc "Resolves one internal User Ticket page."
  def page_internal(_root, %{community: %Community{} = community} = args, %{
        context: %{cur_user: %User{} = actor}
      }) do
    CMS.tickets_page_internal(
      community,
      actor,
      Map.get(args, :filter) || %{},
      Map.get(args, :pagi)
    )
  end

  @doc "Resolves a public User Ticket by Community number."
  def get_public(_root, %{community: %Community{} = community, inner_id: inner_id}, _info) do
    CMS.tickets_get_public(community, inner_id)
  end

  @doc "Resolves an internal Ticket by stable Article id."
  def get_internal(_root, %{community: %Community{} = community, id: id}, %{
        context: %{cur_user: %User{} = actor}
      }) do
    CMS.tickets_get_internal(community, to_string(id), actor)
  end

  @doc "Resolves one paginated internal Ticket Activity stream."
  def activity(%{public_query: true}, _args, _info), do: {:ok, nil}

  def activity(%{article: %{id: ticket_id}, community: %Community{} = community}, args, %{
        context: %{cur_user: %User{} = actor}
      }) do
    CMS.tickets_activity_internal(community, ticket_id, actor, Map.get(args, :pagi))
  end

  @doc "Resolves an internal title-prefix search."
  def search_internal(_root, %{community: %Community{} = community} = args, %{
        context: %{cur_user: %User{} = actor}
      }) do
    CMS.tickets_search_internal(
      community,
      args.query,
      actor,
      Map.get(args, :pagi),
      Map.get(args, :type)
    )
  end

  @doc "Resolves batched public progress records for Post Community numbers."
  def post_progress(_root, %{community: %Community{} = community, post_inner_ids: ids}, _info) do
    with {:ok, progress} <- CMS.tickets_post_progress(community, ids) do
      {:ok,
       Enum.map(progress, fn {post_inner_id, values} ->
         Map.put(values, :post_inner_id, post_inner_id)
       end)}
    end
  end

  @doc "Resolves internally visible User Tickets linked to one Post."
  def linked_to_post_internal(
        _root,
        %{community: %Community{} = community, post_id: post_id},
        %{context: %{cur_user: %User{} = actor}}
      ) do
    CMS.tickets_linked_to_post_internal(community, to_string(post_id), actor)
  end

  @doc "Creates a User Ticket from one public Post."
  def create_from_post(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_create_from_post(
      args.community,
      to_string(args.post_id),
      Map.take(args, [:title, :digest]),
      actor,
      args.command_id
    )
  end

  @doc "Creates a private Worker under a User Ticket."
  def create_worker(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_create_worker(
      args.community,
      to_string(args.parent_id),
      Map.take(args, [:title, :digest]),
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Creates a Case Ticket with an internal content snapshot."
  def create_case(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_create_case(
      args.community,
      Map.take(args, [:title, :digest, :body, :member_ticket_id]),
      actor,
      args.command_id
    )
  end

  @doc "Applies a versioned work-state transition."
  def transition(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_transition(
      args.community,
      to_string(args.id),
      args.status,
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Moves a Ticket within or between work columns."
  def move(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_move(
      args.community,
      to_string(args.id),
      Map.get(args, :status),
      args.rank,
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Updates Ticket priority and planned dates."
  def update(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_update(
      args.community,
      to_string(args.id),
      Map.take(args, [:priority, :planned_start_at, :planned_end_at]),
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Ensures the shared Ticket Draft workspace."
  def ensure_draft(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_ensure_draft(
      args.community,
      to_string(args.id),
      args.expected_lifecycle_version,
      actor,
      args.command_id
    )
  end

  @doc "Saves a shared Ticket Draft."
  def save_draft(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    content = Map.take(args.content, [:title, :digest])

    content =
      if Map.has_key?(args.content, :body),
        do: Map.put(content, :body_bag, args.content.body),
        else: content

    CMS.tickets_save_draft(
      args.community,
      to_string(args.id),
      content,
      args.expected_draft_version,
      args.expected_lifecycle_version,
      actor,
      args.command_id
    )
  end

  @doc "Publishes a reviewed Ticket Draft."
  def publish(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_publish(
      args.community,
      to_string(args.id),
      args.reason,
      args.expected_draft_version,
      args.expected_lifecycle_version,
      args.expected_workflow_version,
      actor,
      args.command_id,
      args.expected_preview
    )
  end

  @doc "Moves a Ticket into Article Draft state."
  def move_to_draft(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_move_to_draft(
      args.community,
      to_string(args.id),
      args.reason,
      args.expected_lifecycle_version,
      actor,
      args.command_id
    )
  end

  @doc "Appends an internal or public progress update."
  def add_update(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_add_update(
      args.community,
      to_string(args.id),
      args.body,
      args.visibility,
      Map.get(args, :supersedes_id),
      Map.get(args, :expected_lifecycle_version),
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Links one supported typed source to a User Ticket."
  def link_source(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_link_source(
      args.community,
      to_string(args.ticket_id),
      args.type,
      to_string(args.source_id),
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Unlinks one TicketSource relation."
  def unlink_source(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_unlink_source(
      args.community,
      to_string(args.ticket_id),
      to_string(args.source_id),
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Adds a User Ticket to a Case."
  def add_case_member(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_add_case_member(
      args.community,
      to_string(args.case_id),
      to_string(args.ticket_id),
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Removes a User Ticket from a Case."
  def remove_case_member(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_remove_case_member(
      args.community,
      to_string(args.case_id),
      to_string(args.ticket_id),
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "References a Case member-owned Worker as a shared fix."
  def add_case_worker(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_add_case_worker(
      args.community,
      to_string(args.case_id),
      to_string(args.worker_id),
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Replaces assigned Community moderators on a Ticket."
  def set_assignees(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_set_assignees(
      args.community,
      to_string(args.ticket_id),
      args.assignee_ids,
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Replaces internal Ticket tags."
  def set_tags(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_set_tags(
      args.community,
      to_string(args.ticket_id),
      args.tag_ids,
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end

  @doc "Replaces normalized Ticket facets."
  def set_facets(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.tickets_set_facets(
      args.community,
      to_string(args.ticket_id),
      args.facets,
      args.expected_workflow_version,
      actor,
      args.command_id
    )
  end
end
