defmodule Helper.PermissionConfig do
  @moduledoc """
  Centralized permission configuration for CMS authorization.

  Business position:

      Domain or web caller
        -> PermissionConfig
        -> normalized value / infrastructure
  """

  alias GroupherServer.CMS
  alias CMS.Artiment.Config
  alias CMS.Passport.ErrorCat

  @default_moderator_permissions ~w(
    post.trash post.restore post.pin post.undo_pin post.sink post.undo_sink
    post.lock_comment post.undo_lock_comment
    blog.trash blog.restore blog.pin blog.undo_pin blog.sink blog.undo_sink
    blog.lock_comment blog.undo_lock_comment
    changelog.trash changelog.restore changelog.pin changelog.undo_pin
    changelog.sink changelog.undo_sink changelog.lock_comment changelog.undo_lock_comment
    doc.queue.write doc.queue.approve doc.queue.publish doc.queue.preview doc.queue.configure
    doc.history.read doc.import
    doc.trash doc.restore doc.pin doc.undo_pin doc.sink doc.undo_sink
    doc.lock_comment doc.undo_lock_comment
    community_tag.create community_tag.update community_tag.reindex
    community_tag.set community_tag.unset
    ticket.create ticket.link_source ticket.update ticket.transition ticket.assign
    ticket.manage_case ticket.manage_visibility ticket.read_internal
  )

  @contexts ["cms"]
  @article_ops [
    "pin",
    "undo_pin",
    "sink",
    "undo_sink",
    "trash",
    "restore",
    "permanent_delete",
    "lock_comment",
    "undo_lock_comment"
  ]

  @doc """
  Returns supported passport contexts.
  """
  def contexts, do: @contexts

  @doc """
  Returns configured article thread slugs.
  """
  def threads, do: Config.threads() |> Enum.map(&to_string/1)

  @doc """
  Returns valid system-level grants.

  Example passport JSON:

      %{
        "global" => %{
          "community.create" => true,
          "god" => true
        }
      }
  """
  def global_grants do
    threaded_grants(["community.mirror", "community.unmirror", "community.move"]) ++
      [
        "god",
        "system_notification.publish",
        "stamp_passport",
        "community.create",
        "community.update",
        "community.request_destroy",
        "community.application.review",
        "community.application.approve",
        "community.application.reject",
        "community.application.retry_creation",
        "community.application.retry_setup",
        "review.platform.read",
        "review.platform.decide",
        "review.platform.configure",
        "category.create",
        "category.update",
        "category.delete",
        "category.set",
        "category.unset"
      ]
  end

  @doc """
  Returns valid community CMS grants.

  Example passport JSON:

      %{
        "<community_slug>" => %{
          "cms" => %{
            "post.edit" => true,
            "moderator.update" => true
          }
        }
      }
  """
  def cms_grants do
    threaded_grants([
      "edit",
      "trash",
      "restore",
      "permanent_delete",
      "pin",
      "undo_pin",
      "sink",
      "undo_sink",
      "lock_comment",
      "undo_lock_comment",
      "community_tag.create",
      "community_tag.update",
      "community_tag.delete",
      "community_tag.set",
      "community_tag.unset"
    ]) ++
      [
        "thread.create",
        "thread.set",
        "thread.unset",
        "moderator.set",
        "moderator.unset",
        "moderator.update",
        "asset.upload",
        "doc.history.read",
        "doc.import",
        "doc.queue.approve",
        "doc.queue.configure",
        "doc.queue.preview",
        "doc.queue.publish",
        "doc.queue.write",
        "community.update",
        "article.insights.read",
        "review.read",
        "review.decide",
        "review.configure",
        "ticket.create",
        "ticket.link_source",
        "ticket.update",
        "ticket.transition",
        "ticket.assign",
        "ticket.manage_case",
        "ticket.manage_visibility",
        "ticket.read_internal"
      ]
  end

  @doc """
  Returns grants for a specific context.
  """
  def grants_for(context) when is_atom(context), do: grants_for(to_string(context))

  def grants_for(context) when is_binary(context) do
    case context do
      "global" -> global_grants()
      "cms" -> cms_grants()
      _ -> []
    end
  end

  def grants_for(_), do: []

  @doc """
  Returns action to requirement mappings.
  """
  def action_requirements do
    fixed_requirements = %{
      # global
      "community.create" => %{scope: :global, grant: "community.create"},
      "community.update" => %{scope: :global, grant: "community.update"},
      "community.request_destroy" => %{
        scope: :global,
        grant: "community.request_destroy"
      },
      "community.application.review" => %{
        scope: :global,
        grant: "community.application.review"
      },
      "community.application.approve" => %{
        scope: :global,
        grant: "community.application.approve"
      },
      "community.application.reject" => %{
        scope: :global,
        grant: "community.application.reject"
      },
      "community.application.retry_creation" => %{
        scope: :global,
        grant: "community.application.retry_creation"
      },
      "community.application.retry_setup" => %{
        scope: :global,
        grant: "community.application.retry_setup"
      },
      "review.platform.read" => %{scope: :global, grant: "review.platform.read"},
      "review.platform.decide" => %{scope: :global, grant: "review.platform.decide"},
      "review.platform.configure" => %{scope: :global, grant: "review.platform.configure"},
      "article.mirror" => %{scope: :global, grant_by_thread: "community.mirror"},
      "article.unmirror" => %{scope: :global, grant_by_thread: "community.unmirror"},
      "article.move" => %{scope: :global, grant_by_thread: "community.move"},
      "article.trash" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "trash",
        owner_fallback: true
      },
      "article.trash.read" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "trash"
      },
      "article.restore" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "restore"
      },
      "article.permanent_delete" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "permanent_delete"
      },
      "audit.read" => %{scope: :context, context: :cms, grant: "community.update"},
      "category.create" => %{scope: :global, grant: "category.create"},
      "category.update" => %{scope: :global, grant: "category.update"},
      "category.delete" => %{scope: :global, grant: "category.delete"},
      "category.set" => %{scope: :global, grant: "category.set"},
      "category.unset" => %{scope: :global, grant: "category.unset"},

      # cms
      "thread.create" => %{scope: :context, context: :cms, grant: "thread.create"},
      "thread.set" => %{scope: :context, context: :cms, grant: "thread.set"},
      "thread.unset" => %{scope: :context, context: :cms, grant: "thread.unset"},
      "moderator.set" => %{scope: :context, context: :cms, grant: "moderator.set"},
      "moderator.unset" => %{scope: :context, context: :cms, grant: "moderator.unset"},
      "moderator.update" => %{scope: :context, context: :cms, grant: "moderator.update"},
      "asset.upload" => %{scope: :context, context: :cms, grant: "asset.upload"},
      "analysis.web.read" => %{scope: :context, context: :cms, grant: "community.update"},
      "article.insights.read" => %{
        scope: :context,
        context: :cms,
        grant: "article.insights.read"
      },
      "review.read" => %{scope: :context, context: :cms, grant: "review.read"},
      "review.decide" => %{scope: :context, context: :cms, grant: "review.decide"},
      "review.configure" => %{scope: :context, context: :cms, grant: "review.configure"},
      "ticket.create" => %{scope: :context, context: :cms, grant: "ticket.create"},
      "ticket.link_source" => %{scope: :context, context: :cms, grant: "ticket.link_source"},
      "ticket.update" => %{scope: :context, context: :cms, grant: "ticket.update"},
      "ticket.transition" => %{scope: :context, context: :cms, grant: "ticket.transition"},
      "ticket.assign" => %{scope: :context, context: :cms, grant: "ticket.assign"},
      "ticket.manage_case" => %{scope: :context, context: :cms, grant: "ticket.manage_case"},
      "ticket.manage_visibility" => %{
        scope: :context,
        context: :cms,
        grant: "ticket.manage_visibility"
      },
      "ticket.read_internal" => %{scope: :context, context: :cms, grant: "ticket.read_internal"},
      "dashboard.theme.update" => %{scope: :context, context: :cms, grant: "community.update"},
      "dashboard.rss.update" => %{scope: :context, context: :cms, grant: "community.update"},
      "community_tag.create" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "community_tag.create"
      },
      "community_tag.update" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "community_tag.update"
      },
      "community_tag.delete" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "community_tag.delete"
      },
      "community_tag.set" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "community_tag.set"
      },
      "community_tag.unset" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "community_tag.unset"
      },
      "community_tag.reindex" => %{
        scope: :context,
        context: :cms,
        grant_by_thread: "community_tag.update"
      },
      "post.update" => %{scope: :context, context: :cms, grant: "post.edit", owner_fallback: true},
      "post.draft.update" => %{owner_fallback: true},
      "post.draft.publish" => %{owner_fallback: true},
      "post.set_category" => %{
        scope: :context,
        context: :cms,
        grant: "post.edit",
        owner_fallback: true
      },
      "doc.update" => %{scope: :context, context: :cms, grant: "doc.edit", owner_fallback: true},
      "doc.history.read" => %{scope: :context, context: :cms, grant: "doc.history.read"},
      "doc.import" => %{scope: :context, context: :cms, grant: "doc.import"},
      "doc.queue.approve" => %{scope: :context, context: :cms, grant: "doc.queue.approve"},
      "doc.queue.configure" => %{scope: :context, context: :cms, grant: "doc.queue.configure"},
      "doc.queue.preview" => %{scope: :context, context: :cms, grant: "doc.queue.preview"},
      "doc.queue.publish" => %{scope: :context, context: :cms, grant: "doc.queue.publish"},
      "doc.queue.write" => %{scope: :context, context: :cms, grant: "doc.queue.write"},
      "blog.update" => %{scope: :context, context: :cms, grant: "blog.edit", owner_fallback: true},
      "blog.draft.update" => %{owner_fallback: true},
      "blog.draft.publish" => %{owner_fallback: true},
      "changelog.update" => %{
        scope: :context,
        context: :cms,
        grant: "changelog.edit",
        owner_fallback: true
      },
      "changelog.draft.update" => %{owner_fallback: true},
      "changelog.draft.publish" => %{owner_fallback: true},
      "comment.update" => %{owner_fallback: true},
      "comment.delete" => %{owner_fallback: true},
      "comment.pin" => %{owner_fallback: true},
      "comment.undo_pin" => %{owner_fallback: true}
    }

    Map.merge(fixed_requirements, generated_thread_action_requirements())
  end

  @doc """
  Returns compatibility examples for passport rules endpoints.
  """
  def passport_rule_examples do
    %{
      god: %{"global" => %{"god" => true}},
      root: %{"global" => %{}, "example-community" => %{"root" => true}},
      moderator: %{"global" => %{}, "example-community" => %{"cms" => %{}}}
    }
  end

  @doc """
  Returns default passport payload for a moderator role.
  """
  def default_passport_for_role("god"), do: {:ok, %{"global" => %{"god" => true}}}
  def default_passport_for_role("root"), do: {:ok, %{"global" => %{}}}
  def default_passport_for_role("moderator"), do: {:ok, %{"global" => %{}}}
  def default_passport_for_role(_), do: {:error, ErrorCat.unknown_role()}

  def default_passport_for_role("moderator", community_slug) when is_binary(community_slug) do
    default_moderator_passport(community_slug)
  end

  def default_passport_for_role(role, community_slug) when is_binary(community_slug) do
    with {:ok, rules} <- default_passport_for_role(role) do
      {:ok, put_default_community_rules(rules, role, community_slug)}
    end
  end

  defp put_default_community_rules(rules, "root", community_slug) do
    Map.put(rules, community_slug, %{"root" => true})
  end

  defp put_default_community_rules(rules, _role, _community_slug), do: rules

  @doc "Runs `default_root_passport` through the public `PermissionConfig` boundary."
  def default_root_passport(community_slug) when is_binary(community_slug) do
    {:ok, put_default_community_rules(%{"global" => %{}}, "root", community_slug)}
  end

  @doc "Builds a canonical, grantable default permission map for a new moderator."
  def default_moderator_passport(community_slug) when is_binary(community_slug) do
    with {:ok, permissions} <-
           CMS.Passport.Catalog.validate_permissions(
             :community,
             Map.new(@default_moderator_permissions, &{&1, true})
           ) do
      {:ok, %{"global" => %{}, community_slug => %{"cms" => permissions}}}
    end
  end

  defp generated_thread_action_requirements do
    threads()
    |> Enum.reduce(%{}, fn thread, acc ->
      Map.merge(acc, direct_thread_requirements(thread, @article_ops))
    end)
  end

  defp direct_thread_requirements(thread, ops) do
    Enum.reduce(ops, %{}, fn op, acc ->
      Map.put(acc, "#{thread}.#{op}", context_requirement("#{thread}.#{op}"))
    end)
  end

  defp context_requirement(grant, extra \\ []) do
    %{scope: :context, context: :cms, grant: grant}
    |> Map.merge(Map.new(extra))
  end

  defp threaded_grants(suffixes) do
    Enum.flat_map(suffixes, fn suffix ->
      Enum.map(threads(), &"#{&1}.#{suffix}")
    end)
  end
end
