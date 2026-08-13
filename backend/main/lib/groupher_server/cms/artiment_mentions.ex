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
  alias GroupherServer.CMS.Model.Comment
  alias Helper.T

  @type target_state :: Store.target_state()
  @type sync_output :: Store.sync_output()
  @type sync_result :: Store.sync_result()

  @spec sync(Comment.t() | T.article() | map()) :: sync_result()
  @doc "Runs `sync` through the public `ArtimentMentions` boundary."
  defdelegate sync(artiment), to: Store

  @spec purge(Comment.t() | T.article() | map()) :: T.domain_res(term())
  @doc "Runs `purge` through the public `ArtimentMentions` boundary."
  defdelegate purge(artiment), to: Store

  @spec purge_article_comments(T.article() | map()) :: T.domain_res(term())
  @doc "Runs `purge_article_comments` through the public `ArtimentMentions` boundary."
  defdelegate purge_article_comments(article), to: Store

  @spec purge_outgoing(T.article() | map()) :: T.domain_res(term())
  @doc "Runs `purge_outgoing` through the public `ArtimentMentions` boundary."
  defdelegate purge_outgoing(artiment), to: Store

  @spec preserve_incoming_deleted(T.article() | map()) :: T.domain_res(:pass)
  @doc "Runs `preserve_incoming_deleted` through the public `ArtimentMentions` boundary."
  defdelegate preserve_incoming_deleted(artiment), to: Store

  @spec mark_target_state(T.article() | map(), target_state()) :: T.domain_res(:pass)
  @doc "Runs `mark_target_state` through the public `ArtimentMentions` boundary."
  defdelegate mark_target_state(artiment, state), to: Store

  @spec mentions(atom(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  @doc "Runs `mentions` through the public `ArtimentMentions` boundary."
  defdelegate mentions(mentioner_type, mentioner_id, filter), to: Store

  @spec mentioned_by(atom(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  @doc "Runs `mentioned_by` through the public `ArtimentMentions` boundary."
  defdelegate mentioned_by(mentioned_type, mentioned_id, filter), to: Store
end
