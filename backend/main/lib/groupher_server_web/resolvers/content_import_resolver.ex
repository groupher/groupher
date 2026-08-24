defmodule GroupherServerWeb.Resolvers.ContentImport do
  @moduledoc """
  Thin GraphQL boundary for community-scoped GitHub Docs imports.

      Dashboard Node -> GraphQL resolver -> Validator / Jobs / Staging / Writer

  Resolvers adapt names and auth context only. Source parsing belongs to Node;
  target validation and transactional persistence belong to Phoenix.

  See `docs/bulk-import/content-import-architecture.md`.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.ContentImport.{Jobs, Staging}
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{Validator, Writer}
  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.CMS.Passport.ErrorCat
  alias GroupherServer.CMS.Passport.Registry

  @doc "Checks one registered community Passport action for the current caller."
  def check_passport(
        _root,
        %{community: community, action: action},
        %{context: %{cur_user: %{cur_passport: passport}}}
      ) do
    case Registry.allowed?(passport, community, action) do
      {:ok, allowed} ->
        {:ok, allowed}

      {:error, %GroupherServer.ErrorCat.Error{reason: :unknown_action}} ->
        {:error, ErrorCat.unknown_action("unknown Passport action #{action}")}

      {:error, %GroupherServer.ErrorCat.Error{reason: :community_required}} ->
        {:error, ErrorCat.community_required("community is required for action #{action}")}
    end
  end

  @doc "Returns read-only target planning for a bounded SourceTree."
  def preview_target(
        _root,
        %{community: %Community{} = community, source_info: source_info, tree: tree},
        _info
      ) do
    Validator.preview(community, stringify_keys(source_info), tree)
  end

  @doc "Creates or resumes the ImportJob for one confirmed Preview intent."
  def start(
        _root,
        %{
          bad_smells: bad_smells,
          community: %Community{} = community,
          dataset_ref: dataset_ref,
          documents: documents,
          preview_ref: preview_ref,
          source_info: source_info,
          target_revision: target_revision,
          target_tree: target_tree
        },
        %{context: %{cur_user: %User{} = user}}
      ) do
    Jobs.create(community, user, %{
      bad_smells: bad_smells,
      dataset_ref: dataset_ref,
      documents: Enum.map(documents, &stringify_keys/1),
      preview_ref: preview_ref,
      source_info: stringify_keys(source_info),
      target_revision: target_revision,
      target_tree: target_tree
    })
  end

  @doc "Returns the current public Job projection."
  def job(_root, %{community: %Community{} = community, job_ref: job_ref}, _info),
    do: Jobs.get(community, job_ref)

  @doc "Applies a ready Job through the atomic Docs Writer."
  def apply(_root, %{community: %Community{} = community, job_ref: job_ref}, _info),
    do: Writer.apply(community, job_ref)

  @doc "Stages one bounded batch of BodyBags or terminal per-item outcomes."
  def stage(
        _root,
        %{community: %Community{} = community, job_ref: job_ref, items: items},
        _info
      ),
      do: Staging.stage(community, job_ref, Enum.map(items, &stringify_keys/1))

  @doc "Records a workflow-level terminal failure on an unfinished Job."
  def fail(
        _root,
        %{community: %Community{} = community, job_ref: job_ref, code: code, message: message},
        _info
      ),
      do: Jobs.fail(community, job_ref, code, message)

  @doc "Cancels an unfinished Job and discards its staged BodyBags."
  def cancel(_root, %{community: %Community{} = community, job_ref: job_ref}, _info),
    do: Jobs.cancel(community, job_ref)

  defp stringify_keys(map) do
    Map.new(map, fn {key, value} ->
      value = if is_map(value), do: stringify_keys(value), else: value
      {to_string(key), value}
    end)
  end
end
