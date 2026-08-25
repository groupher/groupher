defmodule GroupherServer.Repo.Migrations.HardenOauthProviderBindings do
  use Ecto.Migration

  def up do
    # V1 allows one external account per provider on each Groupher user.  Do
    # not silently repair data here: a duplicate is a deployment-stopping
    # invariant violation and must be reviewed separately.
    execute("""
    DO $$
    DECLARE duplicate_groups integer;
    BEGIN
      SELECT count(*) INTO duplicate_groups
      FROM (
        SELECT user_id, provider
        FROM account.oauth_providers
        GROUP BY user_id, provider
        HAVING count(*) > 1
      ) AS duplicates;

      IF duplicate_groups > 0 THEN
        RAISE EXCEPTION
          'oauth provider binding invariant violated: % duplicate (user_id, provider) groups; review rows before retrying migration',
          duplicate_groups;
      END IF;
    END $$;
    """)

    alter table(:oauth_providers, prefix: "account") do
      add(:public_ref, :string)
      add(:inserted_at, :timestamptz)
      add(:updated_at, :timestamptz)
    end

    execute("""
    UPDATE account.oauth_providers
    SET public_ref = 'oauth_' || replace(gen_random_uuid()::text, '-', ''),
        inserted_at = COALESCE(inserted_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
    WHERE public_ref IS NULL
    """)

    create(
      unique_index(:oauth_providers, [:public_ref],
        name: :oauth_providers_public_ref_index,
        prefix: "account"
      )
    )

    create(
      unique_index(:oauth_providers, [:user_id, :provider],
        name: :oauth_providers_user_id_provider_index,
        prefix: "account"
      )
    )

    alter table(:oauth_providers, prefix: "account") do
      modify(:public_ref, :string, null: false)
      modify(:inserted_at, :timestamptz, null: false)
      modify(:updated_at, :timestamptz, null: false)
    end
  end

  def down do
    drop_if_exists(
      index(:oauth_providers, [:user_id, :provider],
        name: :oauth_providers_user_id_provider_index,
        prefix: "account"
      )
    )

    drop_if_exists(
      index(:oauth_providers, [:public_ref],
        name: :oauth_providers_public_ref_index,
        prefix: "account"
      )
    )

    alter table(:oauth_providers, prefix: "account") do
      remove(:public_ref)
      remove(:inserted_at)
      remove(:updated_at)
    end
  end
end
