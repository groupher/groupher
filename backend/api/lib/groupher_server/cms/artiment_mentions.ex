defmodule GroupherServer.CMS.ArtimentMentions do
  @moduledoc """
  Public facade for CMS artiment mention facts.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> ArtimentMentions
        -> Repo / external boundary
  """

  alias __MODULE__.Store
  alias GroupherServer.CMS
  alias CMS.Model.Comment
  alias Helper.T

  @type target_state :: Store.target_state()
  @type sync_output :: Store.sync_output()
  @type sync_result :: Store.sync_result()

  @doc "Runs `sync` through the public `ArtimentMentions` boundary."
  @spec sync(Comment.t() | T.article() | map()) :: sync_result()
  defdelegate sync(artiment), to: Store

  @doc "Runs `purge` through the public `ArtimentMentions` boundary."
  @spec purge(Comment.t() | T.article() | map()) :: T.domain_res(term())
  defdelegate purge(artiment), to: Store

  @doc "Runs `purge_article_comments` through the public `ArtimentMentions` boundary."
  @spec purge_article_comments(T.article() | map()) :: T.domain_res(term())
  defdelegate purge_article_comments(article), to: Store

  @doc "Runs `purge_outgoing` through the public `ArtimentMentions` boundary."
  @spec purge_outgoing(T.article() | map()) :: T.domain_res(term())
  defdelegate purge_outgoing(artiment), to: Store

  @doc "Runs `preserve_incoming_deleted` through the public `ArtimentMentions` boundary."
  @spec preserve_incoming_deleted(T.article() | map()) :: T.domain_res(:pass)
  defdelegate preserve_incoming_deleted(artiment), to: Store

  @doc "Runs `mark_target_state` through the public `ArtimentMentions` boundary."
  @spec mark_target_state(T.article() | map(), target_state()) :: T.domain_res(:pass)
  defdelegate mark_target_state(artiment, state), to: Store

  @doc "Runs `mentions` through the public `ArtimentMentions` boundary."
  @spec mentions(atom(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  defdelegate mentions(mentioner_type, mentioner_id, filter), to: Store

  @doc "Runs `mentioned_by` through the public `ArtimentMentions` boundary."
  @spec mentioned_by(atom(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  defdelegate mentioned_by(mentioned_type, mentioned_id, filter), to: Store
end
