defmodule GroupherServer.CMS.Communities.Tags.Maintenance do
  @moduledoc """
  Runs explicitly named maintenance and fixture tag workflows.

  This is not a user mutation facade. Callers must provide a stable workflow
  reference; the workflow owns the transaction and all taxonomy effects use
  `{:workflow, workflow_ref}` rather than manufacturing a user command id.

      seed / repair job
        -> Tags.Maintenance(workflow_ref)
        -> one Repo transaction
        -> Tags.Mutation / Tags.Persist
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Tags.Assignment
  alias CMS.Communities.Tags.Mutation
  alias CMS.Model.{Community, CommunityTag, CommunityTagGroup}
  alias Helper.T

  @doc "Creates one seed/maintenance tag under an explicit workflow identity."
  @spec create(Community.t(), atom(), map(), term(), String.t()) :: T.domain_res(CommunityTag.t())
  def create(%Community{} = community, thread, attrs, actor, workflow_ref)
      when is_binary(workflow_ref) and workflow_ref != "" do
    transact(workflow_ref, fn ->
      Mutation.create(community, thread, attrs, actor, identity: {:workflow, workflow_ref})
    end)
  end

  @doc "Creates one seed/maintenance tag group under an explicit workflow identity."
  @spec create_group(Community.t(), atom(), map(), String.t()) ::
          T.domain_res(CommunityTagGroup.t())
  def create_group(%Community{} = community, thread, attrs, workflow_ref)
      when is_binary(workflow_ref) and workflow_ref != "" do
    transact(workflow_ref, fn ->
      Mutation.create_group(community, thread, attrs, identity: {:workflow, workflow_ref})
    end)
  end

  @doc "Associates one tag with an Article under an explicit workflow identity."
  @spec add(Ecto.Schema.t(), T.id(), String.t()) :: T.domain_res(Ecto.Schema.t())
  def add(article, tag_id, workflow_ref) when is_binary(workflow_ref) and workflow_ref != "" do
    transact(workflow_ref, fn ->
      Assignment.add(article, tag_id, identity: {:workflow, workflow_ref})
    end)
  end

  @doc "Removes one tag from an Article under an explicit workflow identity."
  @spec remove(Ecto.Schema.t(), T.id(), String.t()) :: T.domain_res(Ecto.Schema.t())
  def remove(article, tag_id, workflow_ref) when is_binary(workflow_ref) and workflow_ref != "" do
    transact(workflow_ref, fn ->
      Assignment.remove(article, tag_id, identity: {:workflow, workflow_ref})
    end)
  end

  @doc "Reindexes one group under an explicit maintenance workflow."
  @spec reindex_in_group(Community.t(), atom(), T.id(), list(), String.t()) ::
          T.domain_res(atom())
  def reindex_in_group(%Community{} = community, thread, group_id, tags, workflow_ref)
      when is_binary(workflow_ref) and workflow_ref != "" do
    transact(workflow_ref, fn ->
      Mutation.reindex_in_group(community, thread, group_id, tags,
        identity: {:workflow, workflow_ref}
      )
    end)
  end

  @doc "Reindexes all tags under an explicit maintenance workflow."
  @spec reindex(Community.t(), atom(), list(), String.t()) :: T.domain_res(atom())
  def reindex(%Community{} = community, thread, tags, workflow_ref)
      when is_binary(workflow_ref) and workflow_ref != "" do
    transact(workflow_ref, fn ->
      Mutation.reindex(community, thread, tags, identity: {:workflow, workflow_ref})
    end)
  end

  @doc "Reindexes tag groups under an explicit maintenance workflow."
  @spec reindex_groups(Community.t(), atom(), list(), String.t()) :: T.domain_res(atom())
  def reindex_groups(%Community{} = community, thread, groups, workflow_ref)
      when is_binary(workflow_ref) and workflow_ref != "" do
    transact(workflow_ref, fn ->
      Mutation.reindex_groups(community, thread, groups, identity: {:workflow, workflow_ref})
    end)
  end

  defp transact(_workflow_ref, fun) when is_function(fun, 0) do
    Repo.transact(fn -> fun.() end)
  end
end
