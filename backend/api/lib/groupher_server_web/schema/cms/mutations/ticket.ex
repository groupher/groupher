defmodule GroupherServerWeb.Schema.CMS.Mutations.Ticket do
  @moduledoc """
  Declares Ticket mutations and their login, Passport and Community middleware.

      GraphQL Ticket mutation
        -> authorization middleware
        -> Ticket resolver and CMS command
  """

  use Helper.GqlSchemaSuite

  object :cms_ticket_mutations do
    @desc "Create a User Ticket Draft from a public Post"
    field :create_ticket_from_post, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:post_id, non_null(:id))
      arg(:title, :string)
      arg(:digest, :string)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.create")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.create_from_post/3)
    end

    @desc "Create a private Worker Ticket under a User Ticket"
    field :create_worker_ticket, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:parent_id, non_null(:id))
      arg(:expected_workflow_version, non_null(:integer))
      arg(:title, :string)
      arg(:digest, :string)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.create")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.create_worker/3)
    end

    @desc "Create an internal Case Ticket"
    field :create_ticket_case, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:title, non_null(:string))
      arg(:digest, :string)
      arg(:body, :string)
      arg(:member_ticket_id, :id)

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.manage_case")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.create_case/3)
    end

    @desc "Transition Ticket work status with an expected version"
    field :transition_ticket, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:status, non_null(:ticket_status_enum))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.transition")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.transition/3)
    end

    @desc "Move a Ticket within or between work columns"
    field :move_ticket, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:status, :ticket_status_enum)
      arg(:rank, non_null(:integer))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.transition")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.move/3)
    end

    @desc "Update Ticket priority or planned dates"
    field :update_ticket, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:priority, :integer)
      arg(:planned_start_at, :datetime)
      arg(:planned_end_at, :datetime)
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.update")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.update/3)
    end

    @desc "Create a content Draft workspace for an already published Ticket"
    field :ensure_ticket_draft, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:expected_lifecycle_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.update")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.ensure_draft/3)
    end

    @desc "Save the Ticket content Draft with Draft and Lifecycle versions"
    field :save_ticket_draft, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:content, non_null(:ticket_content_input))
      arg(:expected_draft_version, non_null(:integer))
      arg(:expected_lifecycle_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.update")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.save_draft/3)
    end

    @desc "Publish the reviewed Ticket Draft with all three expected versions"
    field :publish_ticket, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:expected_preview, non_null(:string))
      arg(:reason, non_null(:string))
      arg(:expected_draft_version, non_null(:integer))
      arg(:expected_lifecycle_version, non_null(:integer))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.manage_visibility")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.publish/3)
    end

    @desc "Move a published Ticket to Draft with its lifecycle version"
    field :move_ticket_to_draft, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:reason, non_null(:string))
      arg(:expected_lifecycle_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.manage_visibility")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.move_to_draft/3)
    end

    @desc "Append an internal or public Ticket progress update"
    field :add_ticket_update, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:body, non_null(:string))
      arg(:visibility, non_null(:ticket_update_visibility_enum))
      arg(:supersedes_id, :id)
      arg(:expected_lifecycle_version, :integer)
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.update")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.add_update/3)
    end

    @desc "Link a typed source to a User Ticket; currently only POST is supported"
    field :link_ticket_source, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:ticket_id, non_null(:id))
      arg(:type, non_null(:ticket_source_type_enum))
      arg(:source_id, non_null(:id))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.link_source")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.link_source/3)
    end

    @desc "Unlink a TicketSource relation by its relation ID"
    field :unlink_ticket_source, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:ticket_id, non_null(:id))
      arg(:source_id, non_null(:id))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.link_source")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.unlink_source/3)
    end

    @desc "Add a User Ticket to a Case"
    field :add_ticket_case_member, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:case_id, non_null(:id))
      arg(:ticket_id, non_null(:id))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.manage_case")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.add_case_member/3)
    end

    @desc "Remove a User Ticket from a Case"
    field :remove_ticket_case_member, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:case_id, non_null(:id))
      arg(:ticket_id, non_null(:id))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.manage_case")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.remove_case_member/3)
    end

    @desc "Reference a member-owned Worker as a shared Case fix"
    field :add_ticket_case_worker, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:case_id, non_null(:id))
      arg(:worker_id, non_null(:id))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.manage_case")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.add_case_worker/3)
    end

    @desc "Replace assigned Community moderators on a Ticket"
    field :set_ticket_assignees, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:ticket_id, non_null(:id))
      arg(:assignee_ids, non_null(list_of(non_null(:integer))))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.assign")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.set_assignees/3)
    end

    @desc "Replace internal Post tags on a Ticket"
    field :set_ticket_tags, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:ticket_id, non_null(:id))
      arg(:tag_ids, non_null(list_of(non_null(:integer))))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.update")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.set_tags/3)
    end

    @desc "Replace normalized internal Ticket facets"
    field :set_ticket_facets, :ticket do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:ticket_id, non_null(:id))
      arg(:facets, non_null(list_of(non_null(:ticket_facet_input))))
      arg(:expected_workflow_version, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "ticket.update")
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.Tickets.set_facets/3)
    end
  end
end
