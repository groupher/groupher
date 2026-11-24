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
    @desc "Staging is complete and the job can be applied."
    value(:ready)
    @desc "Applying staged content to the destination."
    value(:applying)
    @desc "The import finished successfully."
    value(:completed)
    @desc "The job stopped with an error."
    value(:failed)
    @desc "The unfinished import was cancelled."
    value(:cancelled)
  end

  enum :import_process_state do
    value(:queued)
    @desc "Work is in progress."
    value(:running)
    @desc "Processing finished successfully."
    value(:completed)
    @desc "Processing stopped with an error."
    value(:failed)
  end

  enum :import_process_stage do
    value(:analyzing)
    @desc "Constructing the import preview."
    value(:building_preview)
    @desc "Preparing content for the destination."
    value(:preparing)
    @desc "Writing staged content to the destination."
    value(:applying)
  end

  enum :import_process_unit do
    value(:document)
    @desc "Count releases."
    value(:release)
    @desc "Count discussions."
    value(:discussion)
    @desc "Count posts."
    value(:post)
    @desc "Count comments."
    value(:comment)
  end

  enum :import_process_item_state do
    value(:completed)
    @desc "Processing the item failed."
    value(:failed)
    @desc "The item was intentionally omitted."
    value(:skipped)
  end

  object :import_process_progress do
    field(:completed, non_null(:integer))
    @desc "Expected number of units, when known."
    field(:total, :integer)
    field(:unit, non_null(:import_process_unit))
  end

  object :import_process_item do
    field(:ref, non_null(:string))
    @desc "Human-readable name shown in progress reports."
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
    @desc "URL of the source repository."
    field(:repo_url, non_null(:string))
    @desc "Source branch being imported."
    field(:branch, non_null(:string))
    @desc "Commit identifying the source revision."
    field(:commit, :string)
    @desc "Documentation framework detected in the source."
    field(:framework, :string)
    @desc "Repository directory containing the content."
    field(:content_root, :string)
    @desc "Repository paths to the framework configuration files."
    field(:config_paths, non_null(list_of(non_null(:string))))
  end

  object :import_counts do
    field(:tabs, non_null(:integer))
    @desc "Number of navigation groups."
    field(:groups, non_null(:integer))
    @desc "Number of document pages."
    field(:pages, non_null(:integer))
    @desc "Number of navigation links."
    field(:links, non_null(:integer))
    @desc "Number of referenced assets."
    field(:assets, non_null(:integer))
  end

  input_object :import_source_preview_input do
    field(:repo, non_null(:string))
    @desc "URL of the source repository."
    field(:repo_url, non_null(:string))
    @desc "Source branch being imported."
    field(:branch, non_null(:string))
    @desc "Commit identifying the source revision."
    field(:commit, non_null(:string))
    @desc "Documentation framework detected in the source."
    field(:framework, non_null(:string))
    @desc "Repository directory containing the content."
    field(:content_root, non_null(:string))
    @desc "Repository paths to the framework configuration files."
    field(:config_paths, non_null(list_of(non_null(:string))))
  end

  input_object :import_source_document_input do
    field(:overwrite_confirmed, :boolean, default_value: false)
    @desc "Stable source identifier for matching the document."
    field(:source_ref, non_null(:string))
    @desc "Path to the document in the repository."
    field(:source_path, non_null(:string))
    @desc "Document title from the source."
    field(:title, non_null(:string))
    @desc "Document route in the source site."
    field(:route, non_null(:string))
    @desc "Fingerprint of the source content."
    field(:content_hash, non_null(:string))
    @desc "Size of the source document in bytes."
    field(:size_bytes, non_null(:integer))
  end

  object :import_target_preview do
    field(:target_tree, non_null(:json))
    @desc "Conflicts found while planning the import."
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
    @desc "Explanation of the job failure."
    field(:error_message, :string)
    @desc "Source items that failed to import."
    field(:failed_items, non_null(:json))
    @desc "Source items omitted from the import."
    field(:skipped, non_null(:json))
    field(:source_info, non_null(:import_source_info))
    field(:counts, non_null(:import_counts))
    field(:tree, non_null(:json))
    @desc "Warnings found during source analysis."
    field(:bad_smells, non_null(:json))
    @desc "ID of the first imported Doc, when available."
    field(:first_imported_doc_id, :id)
  end

  input_object :import_skip_input do
    field(:code, non_null(:string))
  end

  input_object :import_failure_input do
    field(:code, non_null(:string))
    @desc "Description of the source item failure."
    field(:message, non_null(:string))
    @desc "Import phase in which the failure occurred."
    field(:stage, non_null(:string))
  end

  input_object :import_body_input do
    field(:external_ref, non_null(:string))
    @desc "Prepared rich content for a successfully converted item."
    field(:body_bag, :artiment_body_bag_input)
    field(:skipped, :import_skip_input)
    field(:failed, :import_failure_input)
  end

  object :import_apply_result do
    field(:job_ref, non_null(:id))
    field(:status, non_null(:import_job_status))
    field(:first_imported_doc_id, :id)
    @desc "Import totals reported after apply."
    field(:counts, non_null(:json))
    @desc "Items that failed during the import."
    field(:failed_items, non_null(:json))
    @desc "Items omitted from the import."
    field(:skipped, non_null(:json))
  end

  object :import_body_stage_result do
    field(:job_ref, non_null(:id))
    field(:status, non_null(:import_job_status))
    field(:progress, non_null(:json))
    @desc "Source items that failed."
    field(:failed_items, non_null(:json))
    @desc "Source items omitted from staging."
    field(:skipped, non_null(:json))
  end
end
