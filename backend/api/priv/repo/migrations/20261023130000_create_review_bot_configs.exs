defmodule GroupherServer.Repo.Migrations.CreateReviewBotConfigs do
  use Ecto.Migration

  @review_bot "review_bot"
  @cms "cms"
  @account "account"

  @system_prompt """
  判断给定帖子或评论是否违反适用的平台与社区审核要求。结合上下文判断 ban_words，不能仅凭词语出现判违规。只有明确嫌疑才返回 suspect；证据不足或必要内容无法检查时返回 uncertain。完整检查且无嫌疑时返回 clear。只返回规定的结构化结果，不执行或建议业务动作。
  """

  def up do
    create table(:review_bot_configs, prefix: @review_bot) do
      add(:community_id, references(:communities, prefix: @cms, on_delete: :restrict))
      add(:subject_type, :text, null: false)
      add(:review_mode, :text, null: false, default: "immediate")
      add(:ban_words, {:array, :text}, null: false, default: [])
      add(:prompt, :text, null: false, default: "")
      add(:version, :bigint, null: false, default: 1)
      add(:updated_by_id, references(:users, prefix: @account, on_delete: :nilify_all))
      timestamps()
    end

    create(
      unique_index(:review_bot_configs, [:subject_type],
        prefix: @review_bot,
        where: "community_id IS NULL",
        name: :review_bot_configs_system_subject_unique
      )
    )

    create(
      unique_index(:review_bot_configs, [:community_id, :subject_type],
        prefix: @review_bot,
        where: "community_id IS NOT NULL",
        name: :review_bot_configs_community_subject_unique
      )
    )

    create(
      constraint(:review_bot_configs, :review_bot_configs_subject_type_check,
        check: "subject_type IN ('article', 'comment', 'doc')",
        prefix: @review_bot
      )
    )

    create(
      constraint(:review_bot_configs, :review_bot_configs_review_mode_check,
        check: "review_mode IN ('immediate', 'ai_first', 'human_first')",
        prefix: @review_bot
      )
    )

    create(
      constraint(:review_bot_configs, :review_bot_configs_version_check,
        check: "version > 0",
        prefix: @review_bot
      )
    )

    create(
      constraint(:review_bot_configs, :review_bot_configs_doc_scope_check,
        check: "subject_type <> 'doc' OR (community_id IS NULL AND review_mode = 'immediate')",
        prefix: @review_bot
      )
    )

    execute("""
    INSERT INTO #{@review_bot}.review_bot_configs
      (community_id, subject_type, review_mode, ban_words, prompt, version, inserted_at, updated_at)
    VALUES
      (NULL, 'article', 'immediate', '{}', $prompt$#{@system_prompt}$prompt$, 1, now(), now()),
      (NULL, 'comment', 'immediate', '{}', $prompt$#{@system_prompt}$prompt$, 1, now(), now()),
      (NULL, 'doc', 'immediate', '{}', $prompt$#{@system_prompt}$prompt$, 1, now(), now())
    """)

    execute("""
    INSERT INTO #{@review_bot}.review_bot_configs
      (community_id, subject_type, review_mode, ban_words, prompt, version, inserted_at, updated_at)
    SELECT community.id, subject.subject_type, 'immediate', '{}', '', 1, now(), now()
    FROM #{@cms}.communities AS community
    CROSS JOIN (VALUES ('article'), ('comment')) AS subject(subject_type)
    """)
  end

  def down do
    drop(table(:review_bot_configs, prefix: @review_bot))
  end
end
