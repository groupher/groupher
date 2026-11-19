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
  alias CMS.Model.{Article, ArticleBinding, ArticleLifecycle, ArticleReviewBlock, Author}

  @doc "Builds a batched Doc visibility query from admitted site facts."
  def query(
        actor,
        %Context{
          community: site,
          passport_global_scope: global_scope,
          community_passport_scope: community_scope
        },
        mode
      )
      when mode in [:preview, :comparison, :history] do
    platform =
      CMS.Passport.allowed?(actor, global_scope, CMS.GateAction.review_platform_read()) ==
        {:ok, true}

    local =
      CMS.Passport.allowed?(actor, community_scope, CMS.GateAction.review_read()) == {:ok, true}

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
          join: owner in CMS.Model.ArticleHistoryOwner,
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
          join: l in ArticleLifecycle,
          on: l.article_id == a.id,
          where: l.state in ^states
        )
    end
  end
end
