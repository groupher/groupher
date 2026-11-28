defmodule GroupherLinkedCheckoutGuard do
  @moduledoc false

  # This runs while Mix reads its config, before Ecto can create, migrate or
  # connect to a linked checkout's database.
  def resolve!(root, purpose, registry_dir \\ registry_root()) when purpose in [:dev, :test] do
    case {git(root, "--git-dir"), git(root, "--git-common-dir")} do
      {{:ok, git_dir}, {:ok, common_dir}} ->
        {:ok, checkout_root} = git(root, "--show-toplevel")
        checkout_root = Path.expand(checkout_root)
        linked? = Path.expand(git_dir, root) != Path.expand(common_dir, root)
        primary_file = Path.join(registry_dir, "primary.json")
        claim_file = Path.join([checkout_root, "local/dev-hub/config/checkout-claim.json"])

        cond do
          File.exists?(primary_file) ->
            primary = read_json!(primary_file)

            if primary["version"] == 1 && primary["root"] == checkout_root &&
                 primary["commonDir"] == Path.expand(common_dir, root) do
              verify_primary_claim!(checkout_root, common_dir, primary, registry_dir)
              nil
            else
              secondary_target!(checkout_root, common_dir, purpose, registry_dir)
            end

          linked? or File.exists?(claim_file) ->
            raise "Managed checkout registration is missing; refusing the default database."

          true ->
            nil
        end

      _ ->
        if File.regular?(Path.join(root, ".git")) do
          raise "Cannot determine this linked checkout's database ownership."
        end

        nil
    end
  end

  defp verify_primary_claim!(root, common_dir, primary, registry_dir) do
    registry = read_json!(Path.join(registry_dir, "registry.json"))
    claim = read_json!(Path.join([root, "local/dev-hub/config/checkout-claim.json"]))
    worktree_id = digest(root) |> binary_part(0, 16)
    token = claim["token"]
    environments = registry["environments"]

    matching =
      if is_list(environments),
        do: Enum.filter(environments, &(&1["role"] == "primary")),
        else: []

    unless registry["version"] == 1 && length(matching) == 1 &&
             hd(matching)["root"] == root &&
             hd(matching)["commonDir"] == Path.expand(common_dir, root) &&
             hd(matching)["worktreeId"] == worktree_id &&
             hd(matching)["claimToken"] == primary["claimToken"] &&
             claim["version"] == 1 && claim["worktreeId"] == worktree_id &&
             is_binary(token) && Regex.match?(~r/\A[0-9a-f]{64}\z/, token) &&
             digest(Base.decode16!(token, case: :lower)) == primary["claimToken"] do
      raise "Primary checkout ownership cannot be verified; refusing the default database."
    end
  end

  def secondary_target!(root, common_dir, purpose, registry_dir) do
    {:ok, root} = git(root, "--show-toplevel")
    root = Path.expand(root)
    worktree_id = digest(root) |> binary_part(0, 16)
    primary = read_json!(Path.join(registry_dir, "primary.json"))
    registry = read_json!(Path.join(registry_dir, "registry.json"))
    claim = read_json!(Path.join([root, "local/dev-hub/config/checkout-claim.json"]))
    file = read_json!(Path.join([root, "local/dev-hub/config/database-target.json"]))
    environments = registry["environments"]

    unless primary["version"] == 1 and registry["version"] == 1 and is_list(environments) do
      raise "Invalid database environment registration."
    end

    primary_environments = Enum.filter(environments, &(&1["role"] == "primary"))
    matching_environments = Enum.filter(environments, &(&1["root"] == root))
    primary_env = List.first(primary_environments)
    current = List.first(matching_environments)
    token = claim["token"]

    unless length(primary_environments) == 1 && length(matching_environments) == 1 &&
             primary_env && current && primary_env["root"] == primary["root"] &&
             primary_env["commonDir"] == primary["commonDir"] &&
             primary_env["claimToken"] == primary["claimToken"] &&
             current["role"] == "secondary" && current["worktreeId"] == worktree_id &&
             current["commonDir"] == Path.expand(common_dir, root) &&
             claim["version"] == 1 && claim["worktreeId"] == worktree_id &&
             is_binary(token) && Regex.match?(~r/\A[0-9a-f]{64}\z/, token) &&
             digest(Base.decode16!(token, case: :lower)) == current["claimToken"] &&
             file["version"] == 1 && file["worktreeId"] == worktree_id do
      raise "Database checkout registration or ownership claim does not match."
    end

    slug = current["slug"]

    unless is_binary(slug) && Regex.match?(~r/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/, slug) do
      raise "Invalid registered database slug."
    end

    component = slug |> String.replace("-", "_") |> String.slice(0, 30)
    database = "groupher_#{component}_#{worktree_id}_#{purpose}"
    target = get_in(file, ["targets", Atom.to_string(purpose)])

    unless is_map(target) && target["hostname"] == "127.0.0.1" &&
             target["port"] == 5432 && target["database"] == database do
      raise "Database target is missing or differs from this checkout's allocation."
    end

    validate_environment!(target, purpose)
    validate_mix_paths!(root)
    validate_assets!(registry, current, worktree_id)
    verify_marker!(target, worktree_id, purpose)

    [
      database: database,
      hostname: target["hostname"],
      port: target["port"],
      username: System.get_env("DB_USERNAME", "postgres"),
      password: System.get_env("DB_PASSWORD", "postgres")
    ]
  end

  defp validate_mix_paths!(root) do
    base = Path.join(root, "backend/api")

    for {key, component} <- [{"MIX_BUILD_PATH", "_build"}, {"MIX_DEPS_PATH", "deps"}] do
      expected = Path.join(base, component)

      if value = System.get_env(key) do
        if value != "" and Path.expand(value, base) != expected do
          raise "#{key} must belong to this checkout."
        end
      end

      for segment <- [Path.join(root, "backend"), base, expected] do
        case File.lstat(segment) do
          {:ok, %File.Stat{type: :symlink}} ->
            raise "#{key} cannot use a symlinked checkout path."

          {:ok, _} ->
            :ok

          {:error, :enoent} ->
            :ok

          {:error, _} ->
            raise "Cannot verify #{key} path ownership."
        end
      end
    end
  end

  defp validate_assets!(registry, current, worktree_id) do
    public = System.get_env("ASSETS_PUBLIC_ENDPOINT")
    public_host = "assets.groupher-#{current["slug"]}.localhost"

    if public not in [nil, ""] do
      uri = URI.parse(public)

      unless uri.scheme == "https" and uri.host == public_host and uri.port in [nil, 443] and
               is_nil(uri.userinfo) do
        raise "Assets public endpoint does not belong to this checkout."
      end
    end

    port = get_in(registry, ["runs", worktree_id, "servicePorts", "assets-hub"])

    for key <- ~w(ASSETS_HUB_BATCH_ENDPOINT ASSETS_HUB_DELETE_ENDPOINT) do
      if value = System.get_env(key) do
        if value != "" do
          uri = URI.parse(value)

          unless uri.scheme == "http" and uri.host == "127.0.0.1" and is_integer(port) and
                   uri.port == port and is_nil(uri.userinfo) do
            raise "#{key} does not belong to this checkout's running Assets Hub."
          end
        end
      end
    end
  end

  defp validate_environment!(target, purpose) do
    keys =
      if purpose == :dev do
        [{"DB_NAME", target["database"]}, {"DB_HOST", target["hostname"]}, {"DB_PORT", "5432"}]
      else
        [
          {"TEST_DB_NAME", target["database"]},
          {"TEST_DB_HOST", target["hostname"]},
          {"TEST_DB_PORT", "5432"}
        ]
      end

    for {key, expected} <- keys do
      if value = System.get_env(key) do
        if value != "" and value != expected, do: raise("Conflicting #{key} override.")
      end
    end

    if System.get_env("DATABASE_URL") not in [nil, ""] or
         Enum.any?(System.get_env(), fn {key, value} ->
           String.starts_with?(key, "PG") and value != ""
         end) do
      raise "PostgreSQL connection overrides are not allowed for managed databases."
    end

    for key <- ["NODE_ENV", "MIX_ENV", "ENVIRONMENT", "CLOUDFLARE_ENV"] do
      value = System.get_env(key, "") |> String.trim() |> String.downcase()

      unless value in ["", "dev", "development", "local", "test"] do
        raise "Managed databases require a local development environment."
      end
    end

    if System.get_env("CI") == "true", do: raise("Managed databases are unavailable in CI.")
  end

  defp verify_marker!(target, worktree_id, purpose) do
    sql = """
    SELECT json_build_object('database', current_database(),
      'port', inet_server_port(),
      'comment', shobj_description(oid, 'pg_database'))::text
    FROM pg_database WHERE datname = current_database()
    """

    args = [
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      target["hostname"],
      "-p",
      Integer.to_string(target["port"]),
      "-U",
      System.get_env("DB_USERNAME", "postgres"),
      "-d",
      target["database"],
      "-c",
      sql
    ]

    {output, status} =
      System.cmd("psql", args,
        stderr_to_stdout: true,
        env: [{"PGPASSWORD", System.get_env("DB_PASSWORD", "postgres")}]
      )

    if status != 0, do: raise("Cannot verify managed database ownership before connecting.")
    actual = decode_json!(String.trim(output))
    marker = actual["comment"] && decode_json!(actual["comment"])

    unless actual["database"] == target["database"] && actual["port"] == target["port"] &&
             is_map(marker) && marker["namespace"] == "groupher-devhub" &&
             marker["formatVersion"] == 1 && marker["worktreeId"] == worktree_id &&
             marker["purpose"] == Atom.to_string(purpose) &&
             not Map.has_key?(marker, "run") &&
             (marker["previousComment"] == :null || is_binary(marker["previousComment"])) do
      raise "Managed database ownership marker does not match this checkout."
    end
  end

  defp registry_root do
    home = System.user_home!()

    base =
      case :os.type() do
        {:unix, :darwin} ->
          Path.join(home, "Library/Application Support")

        {:win32, _} ->
          System.get_env("LOCALAPPDATA") || Path.join(home, "AppData/Local")

        _ ->
          xdg = System.get_env("XDG_DATA_HOME")
          if xdg && Path.type(xdg) == :absolute, do: xdg, else: Path.join(home, ".local/share")
      end

    Path.join(base, "Groupher/DevHub")
  end

  defp read_json!(path) do
    case File.read(path) do
      {:ok, contents} -> decode_json!(contents)
      {:error, _} -> raise "Missing managed database configuration: #{path}"
    end
  end

  defp decode_json!(contents) do
    case :json.decode(contents) do
      value when is_map(value) -> value
      _ -> raise "Invalid managed database configuration."
    end
  rescue
    _ -> raise "Invalid managed database configuration or ownership marker."
  end

  defp digest(value), do: :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)

  defp git(root, argument) do
    case System.cmd("git", ["-C", root, "rev-parse", "--path-format=absolute", argument],
           stderr_to_stdout: true
         ) do
      {output, 0} -> {:ok, String.trim(output)}
      _ -> :error
    end
  rescue
    ErlangError -> :error
  end
end
