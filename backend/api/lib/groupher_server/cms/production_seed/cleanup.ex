defmodule GroupherServer.CMS.ProductionSeed.Cleanup do
  @moduledoc """
  Run-scoped report/apply/verify for explicit demo retention or domain cleanup.

      Report + snapshot digest -> admit exact DB -> lock shared namespace
        -> reject foreign dependencies -> close login window -> retain/purge
        -> revoke seed roles -> verify local state + pending external effects

  Fixed users and reserved communities are retained. Neither mode deletes OAuth
  identities, assets or arbitrary queue rows. External effects must drain; verify
  never calls a pending purge/Outbox state complete.
  """
  import Ecto.Query
  alias GroupherServer.CMS.ProductionSeed
  alias GroupherServer.{Repo, CMS}
  alias ProductionSeed.Run
  alias GroupherServer.Accounts.Model.{User, BrowserSession, OauthProvider}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleAssetRef,
    Community,
    Comment,
    Passport
  }

  alias CMS.Model.Mentions.{Edge, Endpoint}

  alias CMS.Outbox.Event

  @doc "Reports a run's exact local scope, blockers and pending effects; no write occurs."
  def report(run_id, database, mode) when mode in ["retain", "purge"] do
    with {:ok, manifest} <- ProductionSeed.report(run_id, database) do
      users = Map.values(manifest["users"])
      communities = Map.values(manifest["communities"])
      resources = Map.values(manifest["resources"] || %{})
      articles = resources |> Enum.map(& &1["articleId"]) |> Enum.reject(&is_nil/1) |> Enum.uniq()
      comments = resources |> Enum.map(& &1["commentId"]) |> Enum.reject(&is_nil/1)

      unknown_bindings =
        Repo.aggregate(
          from(b in ArticleBinding,
            where: b.article_id in ^articles and b.community_id not in ^communities
          ),
          :count
        )

      unknown_comments =
        Repo.aggregate(
          from(c in Comment, where: c.article_id in ^articles and c.id not in ^comments),
          :count
        )

      oauth = Repo.aggregate(from(o in OauthProvider, where: o.user_id in ^users), :count)
      # The fixed dataset has no assets. Any upload/ref requires a separate reviewed asset plan.
      asset_refs =
        Repo.aggregate(from(a in ArticleAssetRef, where: a.community_id in ^communities), :count)

      assets =
        Repo.aggregate(
          from(a in CMS.Model.CommunityAsset, where: a.community_id in ^communities),
          :count
        ) + asset_refs

      external_mentions =
        Repo.aggregate(
          from(edge in Edge,
            join: source in Endpoint,
            on: source.id == edge.source_endpoint_id,
            join: target in Endpoint,
            on: target.id == edge.target_endpoint_id,
            where:
              ((edge.target_type == :comment and target.comment_id in ^comments) or
                 (edge.target_type != :comment and target.article_id in ^articles)) and
                ((source.type == :comment and source.comment_id not in ^comments) or
                   (source.type != :comment and source.article_id not in ^articles))
          ),
          :count
        )

      foreign_sources =
        Repo.aggregate(
          from(s in CMS.Tickets.Model.Source,
            where: s.post_id in ^articles and s.ticket_id not in ^articles
          ),
          :count
        )

      permissions_changed =
        Enum.any?(manifest["users"], fn {name, id} ->
          case Repo.get_by(Passport, user_id: id) do
            nil -> false
            passport -> passport.rules != get_in(manifest, ["passports", name])
          end
        end)

      blockers = if permissions_changed, do: [:seed_permissions_changed], else: []
      blockers = if oauth > 0, do: [:unexpected_oauth | blockers], else: blockers

      blockers =
        if mode == "purge" and
             (unknown_bindings > 0 or unknown_comments > 0 or assets > 0 or external_mentions > 0 or
                foreign_sources > 0) do
          [:foreign_dependency_or_asset | blockers]
        else
          blockers
        end

      tickets =
        Repo.all(
          from(a in Article, where: a.id in ^articles and a.thread == :ticket, select: a.id)
        )

      request_ids =
        Repo.all(
          from(r in CMS.Model.ArtimentReview,
            where: r.article_id in ^articles or r.comment_id in ^comments,
            select: r.id
          )
        )

      effect_ids =
        Enum.uniq(articles ++ request_ids ++ (manifest["deletedReviewRequestIds"] || []))

      effects = effects(effect_ids)

      summary = %{
        run_id: run_id,
        mode: mode,
        status: manifest["status"],
        blockers: blockers,
        users_retained: users,
        communities_retained: communities,
        article_ids: articles,
        comment_ids: comments,
        retained_ticket_ids: tickets,
        oauth_identities: oauth,
        asset_refs: assets,
        unknown_bindings: unknown_bindings,
        unknown_comments: unknown_comments,
        external_mentions: external_mentions,
        foreign_ticket_sources: foreign_sources,
        active_sessions:
          Repo.aggregate(
            from(s in BrowserSession, where: s.user_id in ^users and s.status == :active),
            :count
          ),
        effects: effects
      }

      {:ok, Map.put(summary, :report_digest, digest(summary))}
    end
  end

  def report(_, _, _), do: {:error, :seed_cleanup_mode_required}

  @doc "Applies only a freshly reported explicit retain/purge plan; retries are safe."
  def apply(run_id, database, mode, expected_digest) do
    with {:ok, _} <- ProductionSeed.admit(database) do
      Repo.transaction(
        fn ->
          ProductionSeed.advisory_lock!()
          run = ProductionSeed.lock!(run_id, false)

          if Repo.exists?(from(r in Run, where: r.status == "active" and r.id != ^run.id)) do
            Repo.rollback(:seed_other_run_active)
          end

          ids =
            Map.values(run.manifest["resources"] || %{})
            |> Enum.map(& &1["articleId"])
            |> Enum.reject(&is_nil/1)
            |> Enum.uniq()

          Repo.all(from(a in Article, where: a.id in ^ids, order_by: a.id, lock: "FOR UPDATE"))
          users = Map.values(run.manifest["users"])

          Repo.all(
            from(p in Passport, where: p.user_id in ^users, order_by: p.id, lock: "FOR UPDATE")
          )

          plan =
            case report(run_id, database, mode) do
              {:ok, plan} -> plan
              {:error, reason} -> Repo.rollback(reason)
            end

          if plan.report_digest != expected_digest, do: Repo.rollback(:seed_stale_cleanup_report)
          unless plan.blockers == [], do: Repo.rollback({:seed_cleanup_blocked, plan.blockers})

          if run.manifest["cleanupMode"] && run.manifest["cleanupMode"] != mode do
            Repo.rollback(:seed_cleanup_mode_changed)
          end

          # No running callback may race the destructive domain transition.
          if mode == "purge" and
               (Enum.any?(plan.effects.jobs, &(&1.state == "executing")) or
                  Enum.any?(plan.effects.outbox, &(&1.status == :running))) do
            Repo.rollback(:seed_jobs_running)
          end

          if mode == "purge" and is_nil(run.manifest["cleanupMode"]), do: purge!(run)
          {:ok, _} = ProductionSeed.Logins.close(run_id, database)
          users = plan.users_retained
          now = DateTime.utc_now(:second)

          Repo.update_all(
            from(s in BrowserSession, where: s.user_id in ^users and s.status == :active),
            set: [status: :revoked, revoked_at: now, revoked_reason: "production_seed_cleanup"]
          )

          Repo.delete_all(from(p in Passport, where: p.user_id in ^users))
          run = Repo.get!(Run, run.id)

          run
          |> Ecto.Changeset.change(manifest: Map.put(run.manifest, "cleanupMode", mode))
          |> Repo.update!()

          %{
            status: "closed",
            mode: mode,
            retained_fixed_identities: true,
            external_effects: "verify_after_drain"
          }
        end,
        timeout: 120_000
      )
    end
  end

  @doc "Verifies local cleanup and pending effects; external CDN/browser evidence is separate."
  def verify(run_id, database, mode) do
    with {:ok, plan} <- report(run_id, database, mode) do
      run = Repo.get_by!(Run, run_id: run_id)

      roles =
        Repo.aggregate(from(p in Passport, where: p.user_id in ^plan.users_retained), :count)

      remaining =
        Repo.aggregate(
          from(a in Article,
            where: a.id in ^plan.article_ids and a.id not in ^plan.retained_ticket_ids
          ),
          :count
        )

      published_tickets =
        Repo.aggregate(
          from(l in CMS.Model.ArticleLifecycle,
            where: l.article_id in ^plan.retained_ticket_ids and l.state != :draft
          ),
          :count
        )

      pending = plan.effects.outbox != [] or plan.effects.jobs != []

      if run.status == "closed" and run.manifest["cleanupMode"] == mode and roles == 0 and
           plan.active_sessions == 0 and plan.blockers == [] and
           (mode == "retain" or remaining == 0) and (mode == "retain" or published_tickets == 0) and
           not pending do
        {:ok,
         %{
           local_status: "verified",
           mode: mode,
           retained_articles: remaining,
           retained_tickets: plan.retained_ticket_ids,
           external_status: "requires_CDN_Auth_route_and_evidence_archive_checks"
         }}
      else
        {:error,
         %{
           reason: :seed_cleanup_incomplete,
           report: plan,
           remaining_articles: remaining,
           remaining_roles: roles
         }}
      end
    end
  end

  @doc "Deletes only ledger-owned tmp after rejecting unshared or foreign Articles."
  def delete_tmp(run_id, database) do
    with {:ok, _} <- ProductionSeed.admit(database) do
      Repo.transaction(fn ->
        ProductionSeed.advisory_lock!()
        run = ProductionSeed.lock!(run_id)
        id = run.manifest["communities"]["tmp"]

        community =
          Repo.get_by(Community, id: id, slug: "tmp") || Repo.rollback(:seed_tmp_not_owned)

        owned = Map.values(run.manifest["resources"] || %{}) |> Enum.map(& &1["articleId"])

        Enum.each(Repo.all(from(b in ArticleBinding, where: b.community_id == ^id)), fn binding ->
          unless binding.article_id in owned and
                   Repo.exists?(
                     from(b in ArticleBinding,
                       where: b.article_id == ^binding.article_id and b.community_id != ^id
                     )
                   ) do
            Repo.rollback(:seed_tmp_unshared_or_foreign)
          end
        end)

        requests = Repo.all(from(r in CMS.Model.ArtimentReview, where: r.community_id == ^id))

        owned_comments =
          Map.values(run.manifest["resources"] || %{})
          |> Enum.map(& &1["commentId"])
          |> Enum.reject(&is_nil/1)

        Enum.each(requests, fn request ->
          unless request.article_id in owned or request.comment_id in owned_comments do
            Repo.rollback(:seed_tmp_foreign_review_request)
          end
        end)

        # These disposable-scope requests must not be promoted into platform scope.
        # RESTRICT FKs refuse deletion if a block/receipt still depends on a request.
        Repo.delete_all(from(r in CMS.Model.ArtimentReview, where: r.community_id == ^id))

        Repo.delete_all(
          from(c in GroupherServer.ReviewBot.Model.ReviewBotConfig, where: c.community_id == ^id)
        )

        Repo.delete!(community)

        resources =
          Map.new(run.manifest["resources"] || %{}, fn {name, resource} ->
            if resource["community"] == "tmp" do
              binding =
                Repo.one!(
                  from(b in ArticleBinding,
                    where: b.article_id == ^resource["articleId"],
                    order_by: b.id,
                    limit: 1
                  )
                )

              target = Repo.get!(Community, binding.community_id)
              article = Repo.get!(Article, resource["articleId"])

              locator = %{
                "community" => target.slug,
                "thread" => to_string(article.thread),
                "innerId" => binding.inner_id
              }

              url =
                CMS.FrontDesk.article_url(%{
                  community_slug: target.slug,
                  thread: article.thread,
                  inner_id: binding.inner_id
                })

              {locator, url} =
                if resource["commentId"] do
                  {Map.put(locator, "commentInnerId", resource["innerId"]),
                   url <> "#comment-#{resource["innerId"]}"}
                else
                  {locator, url}
                end

              {name,
               resource
               |> Map.put("community", target.slug)
               |> Map.put(
                 "innerId",
                 if(resource["commentId"], do: resource["innerId"], else: binding.inner_id)
               )
               |> Map.put("locator", locator)
               |> Map.put("url", url)
               |> Map.put("disposable", false)}
            else
              {name, resource}
            end
          end)

        manifest =
          run.manifest
          |> Map.put("resources", resources)
          |> Map.put("deletedTmpId", id)
          |> Map.update(
            "deletedReviewRequestIds",
            Enum.map(requests, & &1.id),
            &Enum.uniq(&1 ++ Enum.map(requests, fn r -> r.id end))
          )

        run |> Ecto.Changeset.change(manifest: manifest) |> Repo.update!()

        %{
          deleted_community_id: id,
          reserved_slug: "tmp",
          manifest_requires_bootstrap: true,
          surviving_locators_updated: true
        }
      end)
    end
  end

  defp purge!(run) do
    articles =
      Map.values(run.manifest["resources"] || %{})
      |> Enum.reject(& &1["commentId"])
      |> Enum.uniq_by(& &1["articleId"])
      |> Enum.sort_by(&if(&1["thread"] == "ticket", do: 0, else: 1))

    Enum.each(articles, fn resource ->
      case Repo.get(Article, resource["articleId"]) do
        nil ->
          nil

        article ->
          community = Repo.get_by!(Community, slug: resource["community"])
          name = if community.slug == "mock", do: "adminMock", else: "adminDev"
          scoped_actor = Repo.get!(User, run.manifest["users"][name])
          {:ok, rules} = CMS.Passport.get_passport(scoped_actor)

          purge_article!(
            article,
            community,
            %{scoped_actor | cur_passport: rules},
            run.manifest["commands"]
          )
      end
    end)
  end

  defp purge_article!(%Article{thread: :ticket} = article, community, actor, commands) do
    internal = command!(CMS.Tickets.get_internal(community, article.id, actor), "ticket-load")

    if Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: article.id).state == :published do
      command!(
        CMS.Tickets.move_to_draft(
          community,
          article.id,
          "Production seed cleanup",
          internal.lifecycle_version,
          actor,
          commands["ticket-cleanup-withdraw"]
        ),
        "ticket-withdraw"
      )
    end

    # Keep the withdrawn Ticket endpoint and facts for incoming references.
    command!(
      CMS.ArtimentMentions.hide_source(%{type: :ticket, article_id: article.id}),
      "ticket-mentions-withdraw"
    )
  end

  defp purge_article!(%Article{thread: :doc} = article, community, actor, _commands) do
    branch = Repo.get_by!(CMS.Model.DocBranch, community_id: community.id, type: :main)

    action =
      command!(
        CMS.Docs.Trash.create_action(community, actor, %{
          root_type: :article,
          root_ref: article.id
        })
      )

    item =
      command!(CMS.Docs.Trash.attach(action, community, branch, article.id, actor), "doc-attach")

    command!(
      CMS.Docs.Trash.permanently_delete(item, community, branch, actor,
        purge_stable_article: true
      ),
      "doc-permanent"
    )

    command!(CMS.Articles.Trash.delete_empty_action(action.id))
  end

  defp purge_article!(article, community, actor, _commands) do
    item =
      command!(
        CMS.Articles.trash(article, actor, community: community),
        "trash-#{article.thread}"
      )

    command!(
      CMS.Articles.permanently_delete_trashed(item.hash_id, actor, community: community),
      "permanent-#{article.thread}"
    )
  end

  defp effects(ids) do
    events =
      Repo.all(
        from(e in Event,
          where: e.resource_id in ^ids,
          order_by: e.id,
          select: %{id: e.id, event: e.event, status: e.status}
        )
      )

    outbox = Enum.reject(events, &(&1.status == :done))
    ids = Enum.uniq(ids ++ Enum.map(events, & &1.id))

    jobs =
      Repo.all(
        from(j in Oban.Job,
          where: j.state in ["available", "scheduled", "executing", "retryable", "discarded"]
        )
      )
      |> Enum.filter(fn j -> Enum.any?(ids, &String.contains?(Jason.encode!(j.args), &1)) end)
      |> Enum.map(&Map.take(&1, [:id, :worker, :state]))

    %{outbox: outbox, jobs: jobs}
  end

  defp digest(plan) do
    :crypto.hash(:sha256, :erlang.term_to_binary(plan)) |> Base.encode16(case: :lower)
  end

  defp command!(result, stage \\ "domain")
  defp command!({:ok, value}, _stage), do: value

  defp command!({:error, reason}, stage) do
    Repo.rollback({:seed_cleanup_domain_failed, stage, reason})
  end
end
