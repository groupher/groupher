defmodule GroupherServer.Repo.Migrations.CreateArticleCoAuthorEvents do
  use Ecto.Migration
  @prefix "cms"

  def up do
    create table(:article_co_author_events, prefix: @prefix, primary_key: false) do
      add(:id, :uuid, primary_key: true)

      add(:article_id, references(:articles, prefix: @prefix, type: :uuid, on_delete: :restrict),
        null: false
      )

      add(:subject_user_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      add(:member_id, :uuid)
      add(:actor_type, :text, null: false)
      add(:actor_id, references(:users, prefix: "account", on_delete: :restrict))
      add(:type, :text, null: false)
      add(:before_permissions, :map, null: false, default: %{})
      add(:after_permissions, :map, null: false, default: %{})

      add(
        :request_id,
        references(:article_co_author_requests,
          prefix: @prefix,
          type: :uuid,
          on_delete: :restrict
        )
      )

      add(:operation_ref, :uuid, null: false)
      add(:operation_index, :integer, null: false)
      add(:occurred_at, :timestamptz, null: false)
      timestamps(updated_at: false)
    end

    create(
      unique_index(:article_co_author_events, [:operation_ref, :operation_index], prefix: @prefix)
    )

    create(index(:article_co_author_events, [:article_id, :occurred_at, :id], prefix: @prefix))

    create(
      constraint(:article_co_author_events, :article_co_author_events_type_check,
        prefix: @prefix,
        check:
          "type IN ('join', 'remove', 'exit', 'grant', 'revoke', 'request_create', 'request_decide', 'request_cancel', 'request_expire')"
      )
    )

    create(
      constraint(:article_co_author_events, :article_co_author_events_actor_type_check,
        prefix: @prefix,
        check: "actor_type IN ('user', 'system')"
      )
    )

    create(
      constraint(:article_co_author_events, :article_co_author_events_actor_check,
        prefix: @prefix,
        check:
          "(actor_type = 'user' AND actor_id IS NOT NULL) OR (actor_type = 'system' AND actor_id IS NULL)"
      )
    )

    create(
      constraint(:article_co_author_events, :article_co_author_events_operation_index_check,
        prefix: @prefix,
        check: "operation_index >= 0"
      )
    )

    create(
      constraint(:article_co_author_events, :article_co_author_events_member_id_check,
        prefix: @prefix,
        check:
          "(type IN ('join', 'remove', 'exit', 'grant', 'revoke') AND member_id IS NOT NULL) OR (type IN ('request_create', 'request_decide', 'request_cancel', 'request_expire'))"
      )
    )
  end

  def down do
    drop(table(:article_co_author_events, prefix: @prefix))
  end
end
