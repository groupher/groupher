defmodule GroupherServer.CMS.Comments.SchemaGeneration do
  @moduledoc """
  Fresh database provenance for the shared discussion cutover.

      provision empty database -> bootstrap generation -> Release verifies before DDL
        -> migrate -> verify target schema + approved fingerprint -> ready
        -> API and worker startup verify the same database, generation and fingerprint

  Migrations cannot mint this record. No business row is initialized or repaired.
  """
  @contract "shared-comments-v1"
  @tables ~w(articles article_bindings article_stats comments comment_review_blocks pinned_comments communities doc_branches doc_drafts doc_lifecycles doc_branch_states doc_branch_versions doc_branch_version_counters doc_publics doc_review_blocks trashed_doc_articles doc_tree_nodes doc_publish_release_articles post_reaction_infos blog_reaction_infos changelog_reaction_infos doc_reaction_infos comment_reaction_infos post_emotion_infos blog_emotion_infos changelog_emotion_infos doc_emotion_infos comment_emotion_infos)
  @functions ~w(guard_doc_binding_identity guard_immutable_identity guard_doc_binding_delete guard_doc_owner_community_delete guard_doc_membership_owner guard_comment_parent_identity enforce_comment_review_block_scope require_doc_owner_at_commit)

  @doc "Attests an explicitly named empty database before business DDL."
  def bootstrap!(repo, expected_database, generation, source, build) do
    verify_database!(repo, expected_database)
    Ecto.UUID.cast!(generation)

    if source in [nil, ""] or build in [nil, ""] do
      raise("bootstrap source and build are required")
    end

    repo.transact(fn ->
      repo.query!("SELECT pg_advisory_xact_lock(hashtext('shared-comments-bootstrap'))", [])

      tables =
        repo.query!(
          """
          SELECT table_schema, table_name FROM information_schema.tables
          WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema')
          """,
          []
        ).rows

      if tables != [] do
        raise("fresh bootstrap requires an empty database; existing schema is not provenance")
      end

      repo.query!(
        """
        CREATE TABLE public.shared_comments_generation (
          singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
          database_name text NOT NULL, database_oid oid NOT NULL,
          generation uuid NOT NULL, contract text NOT NULL,
          phase text NOT NULL CHECK (phase IN ('bootstrap','ready')),
          bootstrap_source text NOT NULL, build text NOT NULL,
          schema_sha256 text, created_at timestamptz NOT NULL DEFAULT now()
        )
        """,
        []
      )

      repo.query!(
        """
        INSERT INTO public.shared_comments_generation
          (database_name,database_oid,generation,contract,phase,bootstrap_source,build)
        SELECT current_database(),oid,$1::uuid,$2,'bootstrap',$3,$4
        FROM pg_database WHERE datname=current_database()
        """,
        [Ecto.UUID.dump!(generation), @contract, source, build]
      )

      {:ok, :bootstrapped}
    end)
  end

  @doc "Checks provenance before Release may execute any migration DDL."
  def verify_before_migration!(repo, opts) do
    record = verify_record!(repo, opts)
    if record.phase == "ready", do: verify_ready!(repo, opts)
    {:ok, :verified}
  end

  @doc "Marks a migrated generation ready only against an externally approved schema hash."
  def mark_ready!(repo, opts) do
    record = verify_record!(repo, opts)
    hash = schema_fingerprint!(repo)
    require_hash!(hash, Keyword.fetch!(opts, :schema_sha256))

    {1, _} =
      repo.query!(
        """
        UPDATE public.shared_comments_generation SET phase='ready',schema_sha256=$1
        WHERE singleton AND generation=$2::uuid AND phase IN ('bootstrap','ready')
        RETURNING generation
        """,
        [hash, Ecto.UUID.dump!(record.generation)]
      )
      |> then(&{&1.num_rows, &1.rows})

    {:ok, %{generation: record.generation, schema_sha256: hash}}
  end

  @doc "Refuses an unready, restored-to-another-database or unapproved schema."
  def verify_ready!(repo, opts \\ environment()) do
    record = verify_record!(repo, opts)
    if record.phase != "ready", do: raise("shared comments generation is not ready")
    expected = Keyword.fetch!(opts, :schema_sha256)
    require_hash!(record.schema_sha256, expected)
    require_hash!(schema_fingerprint!(repo), expected)
    {:ok, :verified}
  end

  @doc "Returns the deploy-manifest coordinates; values never contain credentials."
  def environment do
    [
      database: required_env!("SHARED_COMMENTS_EXPECTED_DATABASE"),
      generation: required_env!("SHARED_COMMENTS_GENERATION"),
      schema_sha256: required_env!("SHARED_COMMENTS_SCHEMA_SHA256")
    ]
  end

  @doc "Fingerprints the target columns, checks, indexes, triggers and guard bodies."
  def schema_fingerprint!(repo) do
    columns =
      repo.query!(
        """
        SELECT table_name,column_name,data_type,is_nullable,column_default
        FROM information_schema.columns WHERE table_schema='cms' AND table_name=ANY($1)
        ORDER BY table_name,ordinal_position
        """,
        [@tables]
      ).rows

    required = [
      {"article_stats", "comments_participants"},
      {"article_stats", "comments_revision"},
      {"comments", "reply_entries_count"},
      {"comments", "reply_participants"},
      {"comments", "last_reply_at"},
      {"comments", "replies_revision"},
      {"article_bindings", "thread"}
    ]

    present = MapSet.new(columns, fn [table, column | _] -> {table, column} end)

    if not Enum.all?(required, &MapSet.member?(present, &1)) or
         Enum.any?(
           [
             {"comments", "branch_id"},
             {"comments", "replies"},
             {"pinned_comments", "branch_id"},
             {"doc_branch_states", "comments_locked"}
           ],
           &MapSet.member?(present, &1)
         ) do
      raise "shared comment schema contract is incomplete"
    end

    constraints =
      repo.query!(
        """
        SELECT c.relname,con.conname,pg_get_constraintdef(con.oid)
        FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='cms' AND c.relname=ANY($1) ORDER BY c.relname,con.conname
        """,
        [@tables]
      ).rows

    indexes =
      repo.query!(
        "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='cms' AND tablename=ANY($1) ORDER BY tablename,indexname",
        [@tables]
      ).rows

    triggers =
      repo.query!(
        """
        SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='cms' AND NOT t.tgisinternal AND c.relname=ANY($1) ORDER BY c.relname,t.tgname
        """,
        [@tables]
      ).rows

    functions =
      repo.query!(
        """
        SELECT p.proname,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='cms' AND p.proname=ANY($1) ORDER BY p.proname
        """,
        [@functions]
      ).rows

    if length(functions) != length(@functions) do
      raise("shared comment identity guards are missing")
    end

    delivery_guards =
      repo.query!(
        """
        SELECT c.relname,pg_get_constraintdef(con.oid)
        FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='messaging' AND c.relname IN ('mentions','notifications')
          AND con.conname='comment_delivery_has_no_body_branch' ORDER BY c.relname
        """,
        []
      ).rows

    if Enum.map(delivery_guards, &hd/1) != ["mentions", "notifications"] do
      raise "stable Comment delivery guards are missing"
    end

    account_guards = account_deletion_guards!(repo)

    :crypto.hash(
      :sha256,
      Jason.encode!([
        columns,
        constraints,
        indexes,
        triggers,
        functions,
        delivery_guards,
        account_guards
      ])
    )
    |> Base.encode16(case: :lower)
  end

  defp account_deletion_guards!(repo) do
    triggers =
      repo.query!(
        """
        SELECT t.tgname,t.tgenabled::text,t.tgtype::integer,p.proname,
          t.tgqual IS NULL,pg_get_triggerdef(t.oid)
        FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace fn ON fn.oid=p.pronamespace
        WHERE n.nspname='account' AND c.relname='users' AND NOT t.tgisinternal
          AND fn.nspname='account'
          AND t.tgname IN ('block_users_physical_delete','block_users_truncate')
        ORDER BY t.tgname
        """,
        []
      ).rows

    expected = [
      {"block_users_physical_delete", "A", 11, "guard_users_physical_deletion", true},
      {"block_users_truncate", "A", 34, "guard_users_physical_deletion", true}
    ]

    actual =
      Enum.map(triggers, fn [name, enabled, type, function, unconditional, _definition] ->
        {name, enabled, type, function, unconditional}
      end)

    if actual != expected do
      raise "physical account deletion guards are missing or not always enabled"
    end

    functions =
      repo.query!(
        """
        SELECT pg_get_functiondef(p.oid) FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='account' AND p.proname='guard_users_physical_deletion'
          AND p.pronargs=0 AND p.prorettype='trigger'::regtype
        """,
        []
      ).rows

    if length(functions) != 1 do
      raise "physical account deletion guard function is missing"
    end

    [triggers, functions]
  end

  defp verify_record!(repo, opts) do
    verify_database!(repo, Keyword.fetch!(opts, :database))
    expected_generation = Keyword.fetch!(opts, :generation)
    Ecto.UUID.cast!(expected_generation)

    [[database, oid]] =
      repo.query!(
        "SELECT current_database(),oid::bigint FROM pg_database WHERE datname=current_database()",
        []
      ).rows

    case repo.query(
           "SELECT database_name,database_oid::bigint,generation::text,contract,phase,schema_sha256 FROM public.shared_comments_generation WHERE singleton",
           []
         ) do
      {:ok, %{rows: [[^database, ^oid, ^expected_generation, @contract, phase, hash]]}} ->
        %{generation: expected_generation, phase: phase, schema_sha256: hash}

      _ ->
        raise "shared comments fresh provenance is missing or does not match the deployment manifest"
    end
  end

  defp verify_database!(repo, expected) when is_binary(expected) and byte_size(expected) > 0 do
    if repo.query!("SELECT current_database()", []).rows != [[expected]] do
      raise("shared comments database identity mismatch")
    end

    {:ok, :verified}
  end

  defp verify_database!(_repo, _expected) do
    raise("expected shared comments database is required")
  end

  defp require_hash!(actual, expected) when is_binary(expected) and byte_size(expected) == 64 do
    if actual != expected, do: raise("shared comments schema fingerprint mismatch")
    {:ok, :verified}
  end

  defp require_hash!(_actual, _expected) do
    raise("approved shared comments schema SHA256 is required")
  end

  defp required_env!(name) do
    case System.get_env(name) do
      value when is_binary(value) and byte_size(value) > 0 -> value
      _ -> raise "#{name} is required"
    end
  end
end
