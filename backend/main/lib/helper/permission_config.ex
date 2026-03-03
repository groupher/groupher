defmodule Helper.PermissionConfig do
  @moduledoc """
  Centralized permission configuration for CMS authorization.
  """

  import Helper.Utils, only: [get_config: 2]

  @contexts ["global", "cms"]
  @article_ops [
    "pin",
    "undo_pin",
    "sink",
    "undo_sink",
    "mark_delete",
    "undo_mark_delete",
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
  def article_threads, do: get_config(:article, :threads) |> Enum.map(&to_string/1)

  @doc """
  Returns valid global-level grants.

  Example passport JSON:

      %{
        "global" => %{
          "community.create" => true,
          "root" => true
        }
      }
  """
  def global_grants do
    threaded_grants(["community.mirror", "community.unmirror", "community.move"]) ++
      [
        "root",
        "blackeye",
        "homemirror",
        "system_accountant",
        "system_notification.publish",
        "stamp_passport",
        "community.create",
        "community.update",
        "community.delete",
        "community.apply.approve",
        "community.apply.deny"
      ]
  end

  @doc """
  Returns valid cms context grants.

  Example passport JSON:

      %{
        "cms" => %{
          "<community_slug>" => %{
            "post.edit" => true,
            "moderator.update" => true
          }
        }
      }
  """
  def cms_grants do
    threaded_grants([
      "edit",
      "mark_delete",
      "undo_mark_delete",
      "delete",
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
        "category.create",
        "category.update",
        "category.delete",
        "category.set",
        "category.unset",
        "moderator.set",
        "moderator.unset",
        "moderator.update",
        "community.update"
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
      "community.delete" => %{scope: :global, grant: "community.delete"},
      "community.apply.approve" => %{scope: :global, grant: "community.apply.approve"},
      "community.apply.deny" => %{scope: :global, grant: "community.apply.deny"},
      "billing.state.update" => %{scope: :global, grant: "system_accountant"},
      "status.count" => %{scope: :global, grant: "root"},
      "article.mirror_home" => %{scope: :global, grant: "homemirror"},
      "article.move_blackhole" => %{scope: :global, grant: "blackeye"},
      "article.mirror" => %{scope: :global, grant_by_thread: "community.mirror"},
      "article.unmirror" => %{scope: :global, grant_by_thread: "community.unmirror"},
      "article.move" => %{scope: :global, grant_by_thread: "community.move"},

      # cms
      "category.create" => %{scope: :context, context: :cms, grant: "category.create"},
      "category.update" => %{scope: :context, context: :cms, grant: "category.update"},
      "category.delete" => %{scope: :context, context: :cms, grant: "category.delete"},
      "category.set" => %{scope: :context, context: :cms, grant: "category.set"},
      "category.unset" => %{scope: :context, context: :cms, grant: "category.unset"},
      "thread.create" => %{scope: :context, context: :cms, grant: "thread.create"},
      "thread.set" => %{scope: :context, context: :cms, grant: "thread.set"},
      "thread.unset" => %{scope: :context, context: :cms, grant: "thread.unset"},
      "moderator.set" => %{scope: :context, context: :cms, grant: "moderator.set"},
      "moderator.unset" => %{scope: :context, context: :cms, grant: "moderator.unset"},
      "moderator.update" => %{scope: :context, context: :cms, grant: "moderator.update"},
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
      "post.set_category" => %{
        scope: :context,
        context: :cms,
        grant: "post.edit",
        owner_fallback: true
      },
      "post.set_state" => %{
        scope: :context,
        context: :cms,
        grant: "post.edit",
        owner_fallback: true
      },
      "doc.update" => %{scope: :context, context: :cms, grant: "doc.edit", owner_fallback: true},
      "blog.update" => %{scope: :context, context: :cms, grant: "blog.edit", owner_fallback: true},
      "changelog.update" => %{
        scope: :context,
        context: :cms,
        grant: "changelog.edit",
        owner_fallback: true
      },
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
      root: %{"global" => %{"root" => true}, "cms" => %{}},
      moderator: %{"global" => %{}, "cms" => %{}}
    }
  end

  @doc """
  Returns default passport payload for a moderator role.
  """
  def default_passport_for_role("root"), do: {:ok, %{"global" => %{"root" => true}, "cms" => %{}}}
  def default_passport_for_role("moderator"), do: {:ok, %{"global" => %{}, "cms" => %{}}}
  def default_passport_for_role(_), do: {:error, :unknown_role}

  defp generated_thread_action_requirements do
    article_threads()
    |> Enum.reduce(%{}, fn thread, acc ->
      acc
      |> Map.merge(direct_thread_requirements(thread, @article_ops))
      |> Map.put(
        "#{thread}.delete",
        context_requirement("#{thread}.delete", owner_fallback: true)
      )
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
      Enum.map(article_threads(), &"#{&1}.#{suffix}")
    end)
  end
end
