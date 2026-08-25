defmodule GroupherServerWeb.Schema.CMS.ContentImport.Types do
  @moduledoc """
  Public GraphQL contract for recoverable ContentImport Jobs and Doc previews.

  See `docs/bulk-import/content-import-architecture.md` for the contracts crossing runtimes.

  Business position:

      Client
        -> Absinthe schema / Types
        -> resolver or domain context
        -> GraphQL response
  """

  use Helper.GqlSchemaSuite

  enum :content_import_job_status do
    value(:staging)
    value(:ready)
    value(:applying)
    value(:completed)
    value(:failed)
    value(:cancelled)
  end

  enum :content_import_process_state do
    value(:queued)
    value(:running)
    value(:completed)
    value(:failed)
  end

  enum :content_import_process_stage do
    value(:analyzing)
    value(:building_preview)
    value(:preparing)
    value(:applying)
  end

  enum :content_import_process_unit do
    value(:document)
    value(:release)
    value(:discussion)
    value(:post)
    value(:comment)
  end

  enum :content_import_process_item_state do
    value(:completed)
    value(:failed)
    value(:skipped)
  end

  object :content_import_process_progress do
    field(:completed, non_null(:integer))
    field(:total, :integer)
    field(:unit, non_null(:content_import_process_unit))
  end

  object :content_import_process_item do
    field(:ref, non_null(:string))
    field(:label, non_null(:string))
    field(:state, non_null(:content_import_process_item_state))
  end

  object :content_import_process do
    field(:state, non_null(:content_import_process_state))
    field(:stage, non_null(:content_import_process_stage))
    field(:progress, :content_import_process_progress)
    field(:recent_batch, non_null(list_of(non_null(:content_import_process_item))))
    field(:updated_at, non_null(:datetime))
  end

  object :content_import_source_info do
    field(:repo, non_null(:string))
    field(:repo_url, non_null(:string))
    field(:branch, non_null(:string))
    field(:commit, :string)
    field(:framework, :string)
    field(:content_root, :string)
    field(:config_paths, non_null(list_of(non_null(:string))))
  end

  object :content_import_counts do
    field(:tabs, non_null(:integer))
    field(:groups, non_null(:integer))
    field(:pages, non_null(:integer))
    field(:links, non_null(:integer))
    field(:assets, non_null(:integer))
  end

  input_object :content_import_source_preview_input do
    field(:repo, non_null(:string))
    field(:repo_url, non_null(:string))
    field(:branch, non_null(:string))
    field(:commit, non_null(:string))
    field(:framework, non_null(:string))
    field(:content_root, non_null(:string))
    field(:config_paths, non_null(list_of(non_null(:string))))
  end

  input_object :content_import_source_document_input do
    field(:source_ref, non_null(:string))
    field(:source_path, non_null(:string))
    field(:title, non_null(:string))
    field(:route, non_null(:string))
    field(:content_hash, non_null(:string))
    field(:size_bytes, non_null(:integer))
  end

  object :content_import_target_preview do
    field(:target_tree, non_null(:json))
    field(:conflicts, non_null(:json))
    field(:counts, non_null(:content_import_counts))
    field(:target_revision, non_null(:string))
  end

  object :content_import_job do
    field(:id, non_null(:id), resolve: fn job, _, _ -> {:ok, job.job_ref} end)
    field(:status, non_null(:content_import_job_status))
    field(:progress, non_null(:json))
    field(:process, non_null(:content_import_process))
    field(:error_code, :string)
    field(:error_message, :string)
    field(:failed_items, non_null(:json))
    field(:skipped, non_null(:json))
    field(:source_info, non_null(:content_import_source_info))
    field(:counts, non_null(:content_import_counts))
    field(:tree, non_null(:json))
    field(:bad_smells, non_null(:json))
    field(:target_branch, non_null(:string))
    field(:first_imported_doc_ref, :id)
  end

  input_object :content_import_skip_input do
    field(:code, non_null(:string))
  end

  input_object :content_import_failure_input do
    field(:code, non_null(:string))
    field(:message, non_null(:string))
    field(:stage, non_null(:string))
  end

  input_object :content_import_body_input do
    field(:external_ref, non_null(:string))
    field(:body_bag, :artiment_body_bag_input)
    field(:skipped, :content_import_skip_input)
    field(:failed, :content_import_failure_input)
  end

  object :content_import_apply_result do
    field(:job_ref, non_null(:id))
    field(:status, non_null(:content_import_job_status))
    field(:first_imported_doc_ref, :id)
    field(:target_branch, non_null(:string))
    field(:counts, non_null(:json))
    field(:failed_items, non_null(:json))
    field(:skipped, non_null(:json))
  end

  object :content_import_body_stage_result do
    field(:job_ref, non_null(:id))
    field(:status, non_null(:content_import_job_status))
    field(:progress, non_null(:json))
    field(:failed_items, non_null(:json))
    field(:skipped, non_null(:json))
  end
end
