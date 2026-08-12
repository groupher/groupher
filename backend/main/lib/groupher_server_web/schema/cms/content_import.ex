defmodule GroupherServerWeb.Schema.CMS.ContentImport do
  @moduledoc """
  GraphQL entry points for the GitHub Docs Dataset import flow.

      Browser or Node
           |
           v
      GraphQL field
           |
           +-- user request ----> Authorize + Passport
           |
           +-- internal request -> scoped Service Identity
           |
           v
      ContentImport resolver

  See `docs/bulk-import/content-import-architecture.md` for trust and ownership boundaries.
  """

  use Helper.GqlSchemaSuite

  object :cms_content_import_queries do
    @desc "check one registered action against the current user's Passport"
    field :check_passport, non_null(:boolean) do
      arg(:community, :string)
      arg(:action, non_null(:string))

      middleware(M.Authorize, :login)
      resolve(&R.ContentImport.check_passport/3)
    end

    @desc "plan a bounded SourceTree against the current Docs target without creating a Job"
    field :preview_doc_content_import_target, non_null(:content_import_target_preview) do
      arg(:community, non_null(:string))
      arg(:source_info, non_null(:content_import_source_preview_input))
      arg(:tree, non_null(:json))

      middleware(M.ServiceScope,
        audience: "phoenix:content-import-api",
        scope: "content-import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.ContentImport.preview_target/3)
    end

    @desc "read one community-scoped ContentImport Job and its safe Doc preview"
    field :content_import_job, :content_import_job do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "doc.import")
      middleware(M.FrontDesk, :community)
      resolve(&R.ContentImport.job/3)
    end
  end

  object :cms_content_import_mutations do
    @desc "create the persistent import Job after a temporary Preview is confirmed"
    field :start_doc_content_import, non_null(:content_import_job) do
      arg(:community, non_null(:string))
      arg(:preview_ref, non_null(:id))
      arg(:source_info, non_null(:content_import_source_preview_input))
      arg(:dataset_ref, non_null(:id))
      arg(:target_tree, non_null(:json))
      arg(:documents, non_null(list_of(non_null(:content_import_source_document_input))))
      arg(:target_revision, non_null(:string))
      arg(:bad_smells, non_null(:json))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "doc.import")

      middleware(M.DelegatedScope,
        audience: "phoenix:content-import-api",
        scope: "content-import:write"
      )

      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.ContentImport.start/3)
    end

    @desc "persist trusted Node-generated BodyBags in bounded batches"
    field :stage_doc_content_import_bodies, non_null(:content_import_body_stage_result) do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))
      arg(:items, non_null(list_of(non_null(:content_import_body_input))))

      middleware(M.ServiceScope,
        audience: "phoenix:content-import-api",
        scope: "content-import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.ContentImport.stage/3)
    end

    @desc "atomically apply all staged BodyBags to the Docs draft"
    field :apply_doc_content_import, non_null(:content_import_apply_result) do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))

      middleware(M.ServiceScope,
        audience: "phoenix:content-import-api",
        scope: "content-import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.ContentImport.apply/3)
    end

    @desc "mark an exhausted import workflow as failed"
    field :fail_doc_content_import, non_null(:content_import_job) do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))
      arg(:code, non_null(:string))
      arg(:message, non_null(:string))

      middleware(M.ServiceScope,
        audience: "phoenix:content-import-api",
        scope: "content-import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.ContentImport.fail/3)
    end

    @desc "cancel an unfinished import Job and discard its staged BodyBags"
    field :cancel_doc_content_import, non_null(:content_import_job) do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))

      middleware(M.ServiceScope,
        audience: "phoenix:content-import-api",
        scope: "content-import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.ContentImport.cancel/3)
    end
  end
end
