defmodule Helper.PermissionRegistry do
  @moduledoc """
  Central registry for action-based permission requirements and known passport rules.
  """

  import Helper.Utils, only: [get_config: 2]

  @article_threads get_config(:article, :threads)

  @article_rule_suffixes [
    "edit",
    "mark_delete",
    "undo_mark_delete",
    "delete",
    "community.mirror",
    "community.unmirror",
    "community.move",
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
  ]

  @general_permissions Enum.reduce(@article_rule_suffixes, [], fn suffix, acc ->
                         acc ++ Enum.map(@article_threads, &"#{&1}.#{suffix}")
                       end) ++
                         [
                           "root",
                           "root.spec",
                           "blackeye",
                           "homemirror",
                           "system_accountant",
                           "system_notification.publish",
                           "stamp_passport",
                           "moderator.set",
                           "moderator.unset",
                           "moderator.update",
                           "community.create",
                           "community.update",
                           "community.delete",
                           "category.create",
                           "category.delete",
                           "category.update",
                           "category.set",
                           "category.unset",
                           "thread.create",
                           "community.apply.approve",
                           "community.apply.deny"
                         ]

  @community_permissions ["thread.set", "thread.unset"]

  @role_templates %{
    "root" => %{
      "global" => %{"root" => true},
      "communities" => %{}
    },
    "moderator" => %{
      "global" => %{
        "post.community_tag.create" => true,
        "post.community_tag.update" => true,
        "post.mark_delete" => true
      },
      "communities" => %{}
    }
  }

  @community_actions %{
    "mutate.create_community" => %{scope: :global, permission: "community.create"},
    "mutate.update_community" => %{scope: :global, permission: "community.update"},
    "mutate.delete_community" => %{scope: :global, permission: "community.delete"},
    "mutate.approve_community_apply" => %{scope: :global, permission: "community.apply.approve"},
    "mutate.deny_community_apply" => %{scope: :global, permission: "community.apply.deny"},
    "mutate.create_category" => %{scope: :global, permission: "category.create"},
    "mutate.delete_category" => %{scope: :global, permission: "category.delete"},
    "mutate.update_category" => %{scope: :global, permission: "category.update"},
    "mutate.create_thread" => %{scope: :global, permission: "thread.create"},
    "mutate.add_moderator" => %{scope: :global, permission: "moderator.set"},
    "mutate.remove_moderator" => %{scope: :global, permission: "moderator.unset"},
    "mutate.update_moderator_passport" => %{scope: :global, permission: "moderator.update"},
    "mutate.set_category" => %{scope: :global, permission: "category.set"},
    "mutate.unset_category" => %{scope: :global, permission: "category.unset"},
    "mutate.set_thread" => %{scope: :community, permission: "thread.set"},
    "mutate.unset_thread" => %{scope: :community, permission: "thread.unset"},
    "mutate.mirror_to_home" => %{scope: :global, permission: "homemirror"},
    "mutate.move_to_blackhole" => %{scope: :global, permission: "blackeye"},
    "mutate.update_bill_state" => %{scope: :global, permission: "system_accountant"},
    "mutate.update_comment" => %{owner_fallback: true},
    "mutate.delete_comment" => %{owner_fallback: true},
    "mutate.pin_comment" => %{owner_fallback: true},
    "mutate.undo_pin_comment" => %{owner_fallback: true},
    "query.count_status" => %{scope: :global, permission: "root"},
    "mutate.update_dashboard_rss" => %{scope: :global, permission: "community.update"}
  }

  @spec requirement(String.t()) :: {:ok, map()} | {:error, :unknown_action}
  def requirement(action) when is_binary(action) do
    case Map.get(@community_actions, action) do
      nil -> article_requirement(action)
      requirement -> {:ok, requirement}
    end
  end

  def requirement(_), do: {:error, :unknown_action}

  @spec role_template(String.t()) :: {:ok, map()} | {:error, :unknown_role}
  def role_template(role) when is_binary(role) do
    case Map.get(@role_templates, role) do
      nil -> {:error, :unknown_role}
      rules -> {:ok, rules}
    end
  end

  def role_template(_), do: {:error, :unknown_role}

  def moderator_titles(:cms), do: ["root", "moderator"]

  def root_passport_item_count, do: 10_000

  def all_passport_rules do
    %{
      root: @role_templates["root"],
      moderator: @role_templates["moderator"]
    }
  end

  def all_rules(:cms), do: %{general: @general_permissions, community: @community_permissions}

  def all_rules(:cms, :stringify) do
    rules = all_rules(:cms)

    %{
      general: rules.general |> Enum.map(fn x -> {x, false} end) |> Map.new() |> Jason.encode!(),
      community:
        rules.community |> Enum.map(fn x -> {x, false} end) |> Map.new() |> Jason.encode!()
    }
  end

  @spec empty_rules() :: map()
  def empty_rules, do: %{"global" => %{}, "communities" => %{}}

  @spec valid_rules?(map()) :: boolean()
  def valid_rules?(%{"global" => global, "communities" => communities} = rules)
      when is_map(global) and is_map(communities) do
    rules
    |> normalize_rules()
    |> permission_keys_from_rules()
    |> Enum.all?(&valid_permission?/1)
  end

  def valid_rules?(_), do: false

  @spec normalize_rules(map()) :: map()
  def normalize_rules(%{"global" => global, "communities" => communities})
      when is_map(global) and is_map(communities) do
    %{
      "global" => normalize_permission_map(global),
      "communities" => normalize_communities_map(communities)
    }
  end

  def normalize_rules(%{global: global, communities: communities})
      when is_map(global) and is_map(communities) do
    normalize_rules(%{"global" => global, "communities" => communities})
  end

  def normalize_rules(nil), do: empty_rules()

  def normalize_rules(_),
    do: raise(ArgumentError, "invalid passport rules shape, expected global/communities maps")

  @spec valid_permission?(String.t()) :: boolean()
  def valid_permission?(permission) when is_binary(permission) do
    permission in @general_permissions or permission in @community_permissions
  end

  def valid_permission?(_), do: false

  defp article_requirement("mutate.create_community_tag"),
    do: {:ok, %{scope: :community_thread, permission_template: "{thread}.community_tag.create"}}

  defp article_requirement("mutate.update_community_tag"),
    do: {:ok, %{scope: :community_thread, permission_template: "{thread}.community_tag.update"}}

  defp article_requirement("mutate.delete_community_tag"),
    do: {:ok, %{scope: :community_thread, permission_template: "{thread}.community_tag.delete"}}

  defp article_requirement("mutate.set_community_tag"),
    do: {:ok, %{scope: :community_thread, permission_template: "{thread}.community_tag.set"}}

  defp article_requirement("mutate.unset_community_tag"),
    do: {:ok, %{scope: :community_thread, permission_template: "{thread}.community_tag.unset"}}

  defp article_requirement("mutate.reindex_tags_in_group"),
    do: {:ok, %{scope: :community_thread, permission_template: "{thread}.community_tag.update"}}

  defp article_requirement("mutate.mirror_article"),
    do: {:ok, %{scope: :thread, permission_template: "{thread}.community.mirror"}}

  defp article_requirement("mutate.unmirror_article"),
    do: {:ok, %{scope: :thread, permission_template: "{thread}.community.unmirror"}}

  defp article_requirement("mutate.move_article"),
    do: {:ok, %{scope: :thread, permission_template: "{thread}.community.move"}}

  defp article_requirement("mutate.update_post"),
    do: {:ok, %{scope: :community_thread, permission: "post.edit", owner_fallback: true}}

  defp article_requirement("mutate.set_post_cat"),
    do: {:ok, %{scope: :community_thread, permission: "post.edit", owner_fallback: true}}

  defp article_requirement("mutate.set_post_state"),
    do: {:ok, %{scope: :community_thread, permission: "post.edit", owner_fallback: true}}

  defp article_requirement("mutate.update_doc"),
    do: {:ok, %{scope: :community_thread, permission: "doc.edit", owner_fallback: true}}

  defp article_requirement("mutate.update_blog"),
    do: {:ok, %{scope: :community_thread, permission: "blog.edit", owner_fallback: true}}

  defp article_requirement("mutate.update_changelog"),
    do: {:ok, %{scope: :community_thread, permission: "changelog.edit", owner_fallback: true}}

  defp article_requirement("mutate.pin_" <> thread),
    do: {:ok, %{scope: :community_thread, permission: "#{thread}.pin"}}

  defp article_requirement("mutate.undo_pin_" <> thread),
    do: {:ok, %{scope: :community_thread, permission: "#{thread}.undo_pin"}}

  defp article_requirement("mutate.lock_" <> rest),
    do:
      {:ok, %{scope: :community_thread, permission: "#{strip_comment_suffix(rest)}.lock_comment"}}

  defp article_requirement("mutate.undo_lock_" <> rest),
    do:
      {:ok,
       %{scope: :community_thread, permission: "#{strip_comment_suffix(rest)}.undo_lock_comment"}}

  defp article_requirement("mutate.mark_delete_" <> thread),
    do: {:ok, %{scope: :thread, permission: "#{thread}.mark_delete"}}

  defp article_requirement("mutate.undo_mark_delete_" <> thread),
    do: {:ok, %{scope: :thread, permission: "#{thread}.undo_mark_delete"}}

  defp article_requirement("mutate.batch_mark_delete_" <> plural_thread),
    do: {:ok, %{scope: :thread, permission: "#{to_singular(plural_thread)}.mark_delete"}}

  defp article_requirement("mutate.batch_undo_mark_delete_" <> plural_thread),
    do: {:ok, %{scope: :thread, permission: "#{to_singular(plural_thread)}.undo_mark_delete"}}

  defp article_requirement("mutate.delete_" <> thread),
    do: {:ok, %{scope: :community_thread, permission: "#{thread}.delete", owner_fallback: true}}

  defp article_requirement("mutate.sink_" <> thread),
    do: {:ok, %{scope: :community_thread, permission: "#{thread}.sink"}}

  defp article_requirement("mutate.undo_sink_" <> thread),
    do: {:ok, %{scope: :community_thread, permission: "#{thread}.undo_sink"}}

  defp article_requirement(_), do: {:error, :unknown_action}

  defp permission_keys_from_rules(%{"global" => global, "communities" => communities})
       when is_map(global) and is_map(communities) do
    global_keys =
      global
      |> Enum.filter(fn {_key, value} -> value == true end)
      |> Enum.map(fn {key, _value} -> key end)

    community_keys =
      communities
      |> Enum.flat_map(fn {_slug, perms} ->
        perms
        |> Enum.filter(fn {_key, value} -> value == true end)
        |> Enum.map(fn {key, _value} -> key end)
      end)

    global_keys ++ community_keys
  end

  defp permission_keys_from_rules(_), do: []

  defp normalize_permission_map(map) do
    Enum.reduce(map, %{}, fn {key, value}, acc ->
      case value do
        true -> Map.put(acc, to_string(key), true)
        false -> Map.put(acc, to_string(key), false)
        _ -> acc
      end
    end)
  end

  defp normalize_communities_map(map) do
    Enum.reduce(map, %{}, fn {key, value}, acc ->
      if is_map(value) do
        Map.put(acc, to_string(key), normalize_permission_map(value))
      else
        acc
      end
    end)
  end

  defp to_singular(plural_thread), do: String.replace_suffix(plural_thread, "s", "")
  defp strip_comment_suffix(rest), do: String.replace_suffix(rest, "_comment", "")
end
