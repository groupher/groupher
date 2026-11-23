defmodule GroupherServerWeb.Schema.CMS.Import do
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
      Import resolver

  See `docs/import/import-architecture.md` for trust and ownership boundaries.
  """

  use Helper.GqlSchemaSuite

  object :cms_import_queries do
    @desc "checks whether the current user can import Docs into this Community"
    field :can_import_docs, non_null(:boolean) do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.Import.can_import_docs/3)
    end

    @desc "plan a bounded SourceTree against the current Docs target without creating a Job"
    field :preview_doc_import_target, non_null(:import_target_preview) do
      arg(:community, non_null(:string))
      arg(:source_info, non_null(:import_source_preview_input))
      arg(:tree, non_null(:json))

      middleware(M.ServiceScope,
        audience: "phoenix:import-api",
        scope: "import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.Import.preview_target/3)
    end

    @desc "read one community-scoped Import Job and its safe Doc preview"
    field :import_job, :import_job do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.Import.job/3)
    end
  end

  object :cms_import_mutations do
    @desc "create the persistent import Job after a temporary Preview is confirmed"
    field :start_doc_import, non_null(:import_job) do
      arg(:community, non_null(:string))
      arg(:preview_ref, non_null(:id))
      arg(:source_info, non_null(:import_source_preview_input))
      arg(:dataset_ref, non_null(:id))
      arg(:target_tree, non_null(:json))
      arg(:documents, non_null(list_of(non_null(:import_source_document_input))))
      arg(:target_revision, non_null(:string))
      arg(:bad_smells, non_null(:json))

      middleware(M.Authorize, :login)

      middleware(M.DelegatedScope,
        audience: "phoenix:import-api",
        scope: "import:write"
      )

      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.Import.start/3)
    end

    @desc "persist trusted Node-generated BodyBags in bounded batches"
    field :stage_doc_import_bodies, non_null(:import_body_stage_result) do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))
      arg(:items, non_null(list_of(non_null(:import_body_input))))

      middleware(M.ServiceScope,
        audience: "phoenix:import-api",
        scope: "import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.Import.stage/3)
    end

    @desc "atomically apply all staged BodyBags to the Docs draft"
    field :apply_doc_import, non_null(:import_apply_result) do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))

      middleware(M.ServiceScope,
        audience: "phoenix:import-api",
        scope: "import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.Import.apply/3)
    end

    @desc "mark an exhausted import workflow as failed"
    field :fail_doc_import, non_null(:import_job) do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))
      arg(:code, non_null(:string))
      arg(:message, non_null(:string))

      middleware(M.ServiceScope,
        audience: "phoenix:import-api",
        scope: "import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.Import.fail/3)
    end

    @desc "cancel an unfinished import Job and discard its staged BodyBags"
    field :cancel_doc_import, non_null(:import_job) do
      arg(:community, non_null(:string))
      arg(:job_ref, non_null(:id))

      middleware(M.ServiceScope,
        audience: "phoenix:import-api",
        scope: "import:write"
      )

      middleware(M.FrontDesk, :community)
      resolve(&R.Import.cancel/3)
    end
  end
end
