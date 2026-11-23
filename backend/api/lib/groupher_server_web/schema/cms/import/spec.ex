defmodule GroupherServerWeb.Schema.CMS.Import.Spec do
  @moduledoc """
  Public GraphQL contract for recoverable Import Jobs and Doc previews.

  See `docs/import/import-architecture.md` for the contracts crossing runtimes.

  Business position:

      Client
        -> Absinthe schema / Types
        -> resolver or domain context
        -> GraphQL response
  """

  use Helper.GqlSchemaSuite

  enum :import_job_status do
    value(:staging)
    value(:ready)
    value(:applying)
    value(:completed)
    value(:failed)
    value(:cancelled)
  end

  enum :import_process_state do
    value(:queued)
    value(:running)
    value(:completed)
    value(:failed)
  end

  enum :import_process_stage do
    value(:analyzing)
    value(:building_preview)
    value(:preparing)
    value(:applying)
  end

  enum :import_process_unit do
    value(:document)
    value(:release)
    value(:discussion)
    value(:post)
    value(:comment)
  end

  enum :import_process_item_state do
    value(:completed)
    value(:failed)
    value(:skipped)
  end

  object :import_process_progress do
    field(:completed, non_null(:integer))
    field(:total, :integer)
    field(:unit, non_null(:import_process_unit))
  end

  object :import_process_item do
    field(:ref, non_null(:string))
    field(:label, non_null(:string))
    field(:state, non_null(:import_process_item_state))
  end

  object :import_process do
    field(:state, non_null(:import_process_state))
    field(:stage, non_null(:import_process_stage))
    field(:progress, :import_process_progress)
    field(:recent_batch, non_null(list_of(non_null(:import_process_item))))
    field(:updated_at, non_null(:datetime))
  end

  object :import_source_info do
    field(:repo, non_null(:string))
    field(:repo_url, non_null(:string))
    field(:branch, non_null(:string))
    field(:commit, :string)
    field(:framework, :string)
    field(:content_root, :string)
    field(:config_paths, non_null(list_of(non_null(:string))))
  end

  object :import_counts do
    field(:tabs, non_null(:integer))
    field(:groups, non_null(:integer))
    field(:pages, non_null(:integer))
    field(:links, non_null(:integer))
    field(:assets, non_null(:integer))
  end

  input_object :import_source_preview_input do
    field(:repo, non_null(:string))
    field(:repo_url, non_null(:string))
    field(:branch, non_null(:string))
    field(:commit, non_null(:string))
    field(:framework, non_null(:string))
    field(:content_root, non_null(:string))
    field(:config_paths, non_null(list_of(non_null(:string))))
  end

  input_object :import_source_document_input do
    field(:source_ref, non_null(:string))
    field(:source_path, non_null(:string))
    field(:title, non_null(:string))
    field(:route, non_null(:string))
    field(:content_hash, non_null(:string))
    field(:size_bytes, non_null(:integer))
  end

  object :import_target_preview do
    field(:target_tree, non_null(:json))
    field(:conflicts, non_null(:json))
    field(:counts, non_null(:import_counts))
    field(:target_revision, non_null(:string))
  end

  object :import_job do
    field(:id, non_null(:id), resolve: fn job, _, _ -> {:ok, job.job_ref} end)
    field(:status, non_null(:import_job_status))
    field(:progress, non_null(:json))
    field(:process, non_null(:import_process))
    field(:error_code, :string)
    field(:error_message, :string)
    field(:failed_items, non_null(:json))
    field(:skipped, non_null(:json))
    field(:source_info, non_null(:import_source_info))
    field(:counts, non_null(:import_counts))
    field(:tree, non_null(:json))
    field(:bad_smells, non_null(:json))
    field(:first_imported_doc_id, :id)
  end

  input_object :import_skip_input do
    field(:code, non_null(:string))
  end

  input_object :import_failure_input do
    field(:code, non_null(:string))
    field(:message, non_null(:string))
    field(:stage, non_null(:string))
  end

  input_object :import_body_input do
    field(:external_ref, non_null(:string))
    field(:body_bag, :artiment_body_bag_input)
    field(:skipped, :import_skip_input)
    field(:failed, :import_failure_input)
  end

  object :import_apply_result do
    field(:job_ref, non_null(:id))
    field(:status, non_null(:import_job_status))
    field(:first_imported_doc_id, :id)
    field(:counts, non_null(:json))
    field(:failed_items, non_null(:json))
    field(:skipped, non_null(:json))
  end

  object :import_body_stage_result do
    field(:job_ref, non_null(:id))
    field(:status, non_null(:import_job_status))
    field(:progress, non_null(:json))
    field(:failed_items, non_null(:json))
    field(:skipped, non_null(:json))
  end
end
