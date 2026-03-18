Mix.Task.run("app.start")

defmodule Scripts.MigratePassportRules do
  import Ecto.Query, warn: false

  alias Ecto.Changeset
  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.Passport
  alias Helper.PermissionRegistry

  @empty_rules %{"global" => %{}, "cms" => %{}}

  def run(argv) do
    {opts, _argv, invalid} = OptionParser.parse(argv, strict: [dry_run: :boolean])

    if invalid != [] do
      raise "Unknown options: #{inspect(invalid)}\nUsage: mix run scripts/migrate_passport_rules.exs [--dry-run]"
    end

    dry_run = Keyword.get(opts, :dry_run, false)

    IO.puts("Migrating passport rules#{if dry_run, do: " (dry-run)", else: ""}...")

    Passport
    |> order_by([p], asc: p.id)
    |> Repo.all()
    |> Enum.reduce(summary_template(dry_run), &migrate_passport/2)
    |> print_summary()
  end

  defp migrate_passport(passport, summary) do
    detected_shape = detect_shape(passport.rules)
    migrated_rules = passport.rules |> normalize_legacy_rules() |> sanitize_passport_rules()

    cond do
      passport.rules == migrated_rules ->
        maybe_log_unchanged(passport, detected_shape)
        increment(summary, :unchanged)

      summary.dry_run ->
        IO.puts(
          "DRY-RUN migrate passport_id=#{passport.id} user_id=#{passport.user_id} shape=#{detected_shape}"
        )

        increment(summary, :migrated)

      true ->
        case update_passport(passport, migrated_rules) do
          {:ok, _passport} ->
            IO.puts(
              "migrated passport_id=#{passport.id} user_id=#{passport.user_id} shape=#{detected_shape}"
            )

            increment(summary, :migrated)

          {:error, reason} ->
            IO.puts(
              "failed passport_id=#{passport.id} user_id=#{passport.user_id} shape=#{detected_shape} reason=#{inspect(reason)}"
            )

            summary
            |> increment(:failed)
            |> record_failure(passport, reason)
        end
    end
  rescue
    error ->
      IO.puts(
        "failed passport_id=#{passport.id} user_id=#{passport.user_id} shape=error reason=#{Exception.message(error)}"
      )

      summary
      |> increment(:failed)
      |> record_failure(passport, error)
  end

  defp update_passport(passport, migrated_rules) do
    passport
    |> Changeset.change(rules: migrated_rules)
    |> Repo.update()
  end

  defp maybe_log_unchanged(passport, detected_shape) do
    if detected_shape != :canonical do
      IO.puts(
        "unchanged passport_id=#{passport.id} user_id=#{passport.user_id} shape=#{detected_shape}"
      )
    end
  end

  defp normalize_legacy_rules(%{"global" => global, "cms" => cms})
       when is_map(global) and is_map(cms) do
    %{"global" => global, "cms" => cms}
  end

  defp normalize_legacy_rules(%{global: global, cms: cms}) when is_map(global) and is_map(cms) do
    %{"global" => global, "cms" => cms}
  end

  defp normalize_legacy_rules(rules) when is_map(rules) do
    if Enum.all?(rules, fn {_key, value} -> is_map(value) end) do
      %{"global" => %{}, "cms" => rules}
    else
      %{"global" => rules, "cms" => %{}}
    end
  end

  defp normalize_legacy_rules(_), do: @empty_rules

  defp sanitize_passport_rules(rules) do
    %{"global" => global, "cms" => cms} = PermissionRegistry.normalize_rules(rules)

    %{
      "global" => filter_global_rule_map(global),
      "cms" =>
        cms
        |> Enum.reduce(%{}, fn {community, permissions}, acc ->
          filtered_permissions = filter_cms_rule_map(permissions)

          if map_size(filtered_permissions) == 0 do
            acc
          else
            Map.put(acc, to_string(community), filtered_permissions)
          end
        end)
    }
  end

  defp filter_global_rule_map(map) when is_map(map) do
    Enum.reduce(map, %{}, fn {rule, value}, acc ->
      rule = to_string(rule)

      if PermissionRegistry.valid_global_permission?(rule) and value == true do
        Map.put(acc, rule, true)
      else
        acc
      end
    end)
  end

  defp filter_global_rule_map(_), do: %{}

  defp filter_cms_rule_map(map) when is_map(map) do
    Enum.reduce(map, %{}, fn {rule, value}, acc ->
      rule = to_string(rule)

      if PermissionRegistry.valid_context_permission?("cms", rule) and value == true do
        Map.put(acc, rule, true)
      else
        acc
      end
    end)
  end

  defp filter_cms_rule_map(_), do: %{}

  defp detect_shape(%{"global" => global, "cms" => cms}) when is_map(global) and is_map(cms),
    do: :canonical

  defp detect_shape(%{global: global, cms: cms}) when is_map(global) and is_map(cms),
    do: :canonical_atom_keys

  defp detect_shape(rules) when is_map(rules) do
    if Enum.all?(rules, fn {_key, value} -> is_map(value) end) do
      :legacy_cms
    else
      :legacy_global
    end
  end

  defp detect_shape(nil), do: :nil_rules
  defp detect_shape(_), do: :invalid_rules

  defp summary_template(dry_run) do
    %{dry_run: dry_run, scanned: 0, unchanged: 0, migrated: 0, failed: 0, failures: []}
  end

  defp increment(summary, key) do
    summary
    |> Map.update!(:scanned, &(&1 + 1))
    |> Map.update!(key, &(&1 + 1))
  end

  defp record_failure(summary, passport, reason) do
    failure = %{passport_id: passport.id, user_id: passport.user_id, reason: inspect(reason)}
    Map.update!(summary, :failures, &[failure | &1])
  end

  defp print_summary(summary) do
    IO.puts("\nDone.")
    IO.puts("  scanned: #{summary.scanned}")
    IO.puts("  unchanged: #{summary.unchanged}")
    IO.puts("  migrated: #{summary.migrated}")
    IO.puts("  failed: #{summary.failed}")

    if summary.failed > 0 do
      IO.puts("\nFailures:")

      summary.failures
      |> Enum.reverse()
      |> Enum.each(fn failure ->
        IO.puts(
          "  passport_id=#{failure.passport_id} user_id=#{failure.user_id} reason=#{failure.reason}"
        )
      end)
    end
  end
end

Scripts.MigratePassportRules.run(System.argv())
