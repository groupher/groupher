defmodule GroupherServer.CMS.Gate.Scope.DocsContent do
  @moduledoc """
  Composes site-owned preview and history content visibility after site admission.

      read-only site Gate -> typed Community facts -> bound Doc / current Review filters -> query

  History can resolve an immutable Article after workspace purge. Preview requires
  an active workspace lifecycle. Neither mode makes private content public.
  """
  import Ecto.Query
  alias GroupherServer.CMS
  alias CMS.Gate.Context.Access.Community, as: Context
  alias CMS.Gate.Scope.ReviewRead
  alias CMS.Model.{Article, ArticleBinding, ArticleReviewBlock, Author, DocsLifecycle}

  @doc "Builds a batched Doc visibility query from admitted site facts."
  def query(actor, %Context{community: site, passport_rules: rules}, mode)
      when mode in [:preview, :comparison, :history] do
    grants = ReviewRead.grants(%{actor | cur_passport: rules})
    platform = grants.platform?
    local = site.slug in grants.community_slugs

    blocked =
      from(b in ArticleReviewBlock,
        where:
          is_nil(b.resolved_at) and
            ((is_nil(b.community_id) and not (^platform)) or
               (b.community_id == ^site.id and not (^local))),
        select: b.article_id
      )

    query =
      from(a in Article,
        join: author in Author,
        on: author.id == a.author_id,
        where: a.thread == :doc,
        where: a.id not in subquery(blocked) or author.user_id == ^actor.id
      )

    case mode do
      :history ->
        from(a in query,
          join: owner in CMS.Model.DocsHistoryOwner,
          on: owner.article_id == a.id and owner.community_id == ^site.id
        )

      mode when mode in [:preview, :comparison] ->
        states =
          if mode == :comparison,
            do: [:draft, :published, :archived, :deleted],
            else: [:draft, :published, :archived]

        from(a in query,
          join: binding in ArticleBinding,
          on:
            binding.article_id == a.id and binding.community_id == ^site.id and
              binding.thread == :doc,
          join: l in DocsLifecycle,
          on: l.article_id == a.id and l.community_id == ^site.id,
          where: l.state in ^states
        )
    end
  end
end
