defmodule GroupherServer.Test.CMS.ReviewDecisionTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{AlertWall, CMS, Repo, ReviewBot}

  alias CMS.Model.{
    ArticleLifecycle,
    ArticleReviewBlock,
    ArtimentReview,
    CommentReviewBlock,
    DocReviewBlock
  }

  alias AlertWall.Model.{Item, UserReport}
  alias ReviewBot.Model.ReviewBotConfig
  import ExUnit.CaptureIO

  test "report threshold is read from validated runtime policy" do
    previous = Application.get_env(:groupher_server, :cms_review_report_threshold)

    on_exit(fn ->
      if is_nil(previous) do
        Application.delete_env(:groupher_server, :cms_review_report_threshold)
      else
        Application.put_env(:groupher_server, :cms_review_report_threshold, previous)
      end
    end)

    Application.put_env(:groupher_server, :cms_review_report_threshold, 5)

    assert CMS.Review.Config.report_threshold() == 5
  end

  test "human reject and approve run as receipt-backed CMS decisions" do
    {community, article, _attrs, _author} = mock_article(:post)
    {:ok, reviewer} = db_insert(:user)

    reviewer = %{
      reviewer
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.decide" => true}}
        }
    }

    target_key = "article:#{article.id}"
    scope_key = "community:#{community.id}"

    assert {:error, _reason} =
             CMS.decide_review_target(
               target_key,
               scope_key,
               :approve,
               reviewer,
               Ecto.UUID.generate()
             )

    Repo.update_all(
      from(request in ArtimentReview,
        where:
          request.article_id == ^article.id and request.community_id == ^community.id and
            is_nil(request.outdated_at)
      ),
      set: [state: :failed]
    )

    assert {:ok, _result} =
             CMS.decide_review_target(
               target_key,
               scope_key,
               :approve,
               reviewer,
               Ecto.UUID.generate()
             )

    Repo.update_all(
      from(request in ArtimentReview,
        where:
          request.article_id == ^article.id and request.community_id == ^community.id and
            is_nil(request.outdated_at)
      ),
      set: [state: :queued]
    )

    {:ok, before_revision} = CMS.ArtimentMentions.GraphRevision.current(community.id)

    assert {:ok, _result} =
             CMS.decide_review_target(
               target_key,
               scope_key,
               :reject,
               reviewer,
               Ecto.UUID.generate()
             )

    assert %ArticleReviewBlock{type: :manual_hold, source: :human} =
             Repo.one!(
               from(restriction in ArticleReviewBlock,
                 where:
                   restriction.article_id == ^article.id and
                     restriction.community_id == ^community.id and
                     restriction.source == :human and is_nil(restriction.resolved_at)
               )
             )

    assert {:ok, denied_revision} = CMS.ArtimentMentions.GraphRevision.current(community.id)
    assert denied_revision > before_revision

    assert {:ok, _result} =
             CMS.decide_review_target(
               target_key,
               scope_key,
               :approve,
               reviewer,
               Ecto.UUID.generate()
             )

    assert Repo.aggregate(
             from(restriction in ArticleReviewBlock,
               where:
                 restriction.article_id == ^article.id and
                   restriction.community_id == ^community.id and restriction.source == :human and
                   is_nil(restriction.resolved_at)
             ),
             :count
           ) == 0

    assert {:ok, released_revision} = CMS.ArtimentMentions.GraphRevision.current(community.id)
    assert released_revision > denied_revision
  end

  test "a CMS decision resolves a report-only Wall item in its own scope" do
    {community, article, _attrs, _author} = mock_article(:post)
    {:ok, reporter} = db_insert(:user)
    {:ok, reviewer} = db_insert(:user)

    reviewer = %{
      reviewer
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.decide" => true}}
        }
    }

    assert {:ok, {:ok, report}} =
             Repo.transaction(fn ->
               AlertWall.submit_report_in_transaction(
                 %{
                   reporter_id: reporter.id,
                   owner: :cms,
                   target_type: :article,
                   target_id: article.id,
                   observed_version: 1,
                   community_id: community.id,
                   report_type: "SPAM",
                   details: "Please review"
                 },
                 Ecto.UUID.generate()
               )
             end)

    assert %Item{ai_source_ref: nil, status: :open} = Repo.get!(Item, report.item_id)

    assert {:ok, _result} =
             CMS.decide_review_target(
               "article:#{article.id}",
               "community:#{community.id}",
               :reject,
               reviewer,
               Ecto.UUID.generate()
             )

    assert Repo.get!(Item, report.item_id).status == :resolved
    assert Repo.get!(UserReport, report.id).resolved_at
  end

  test "the report threshold atomically hides the Article and reuses one hold" do
    {community, article, _attrs, _author} = mock_article(:post)

    reporters =
      Enum.map(1..4, fn _ ->
        {:ok, reporter} = db_insert(:user)
        reporter
      end)

    reports =
      reporters
      |> Enum.with_index(1)
      |> Enum.map(fn {reporter, count} ->
        assert {:ok, report} =
                 GroupherServer.AlertWall.Commands.SubmitReport.execute(
                   %{
                     owner: :cms,
                     target_type: :article,
                     target_id: article.id,
                     community_id: community.id,
                     observed_version: 1
                   },
                   :spam,
                   "Please review",
                   reporter,
                   Ecto.UUID.generate()
                 )

        if count < CMS.Review.Config.report_threshold() do
          refute Repo.exists?(
                   from(block in ArticleReviewBlock,
                     where:
                       block.article_id == ^article.id and block.community_id == ^community.id and
                         block.type == :report_threshold_hold and is_nil(block.resolved_at)
                   )
                 )
        end

        report
      end)

    assert length(Enum.uniq_by(reports, & &1.reporter_id)) == 4
    item_id = List.last(reports).item_id
    source_ref = "report_threshold:item:#{item_id}"

    assert %ArticleReviewBlock{
             type: :report_threshold_hold,
             source: :domain,
             source_ref: ^source_ref,
             resolved_at: nil
           } =
             Repo.get_by!(ArticleReviewBlock,
               article_id: article.id,
               community_id: community.id,
               type: :report_threshold_hold
             )

    wall_item = Repo.get!(Item, item_id)
    {:ok, moderator} = db_insert(:user)

    moderator = %{
      moderator
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.decide" => true}}
        }
    }

    assert {:ok, %{item_id: ^item_id}} =
             AlertWall.resolve_item(
               wall_item.id,
               "reviewed",
               wall_item.version,
               moderator,
               Ecto.UUID.generate()
             )

    assert Repo.get_by!(ArticleReviewBlock,
             article_id: article.id,
             community_id: community.id,
             type: :report_threshold_hold
           ).resolved_at == nil

    assert Repo.aggregate(
             from(block in ArticleReviewBlock,
               where:
                 block.article_id == ^article.id and block.community_id == ^community.id and
                   block.type == :report_threshold_hold and is_nil(block.resolved_at)
             ),
             :count
           ) == 1
  end

  test "approve clears a report threshold hold and resolves its open Wall item" do
    {community, article, _attrs, _author} = mock_article(:post)

    reports =
      Enum.map(1..CMS.Review.Config.report_threshold(), fn _ ->
        {:ok, reporter} = db_insert(:user)

        assert {:ok, report} =
                 GroupherServer.AlertWall.Commands.SubmitReport.execute(
                   %{
                     owner: :cms,
                     target_type: :article,
                     target_id: article.id,
                     community_id: community.id,
                     observed_version: 1
                   },
                   :spam,
                   "threshold review",
                   reporter,
                   Ecto.UUID.generate()
                 )

        report
      end)

    item_id = List.last(reports).item_id
    {:ok, moderator} = db_insert(:user)

    moderator = %{
      moderator
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.decide" => true}}
        }
    }

    Repo.update_all(
      from(request in ArtimentReview,
        where: request.article_id == ^article.id and request.community_id == ^community.id
      ),
      set: [state: :failed]
    )

    assert Repo.exists?(
             from(block in ArticleReviewBlock,
               where:
                 block.article_id == ^article.id and block.type == :report_threshold_hold and
                   is_nil(block.resolved_at)
             )
           )

    assert {:ok, _} =
             CMS.decide_review_target(
               "article:#{article.id}",
               "community:#{community.id}",
               :approve,
               moderator,
               Ecto.UUID.generate()
             )

    refute Repo.exists?(
             from(block in ArticleReviewBlock,
               where:
                 block.article_id == ^article.id and block.type == :report_threshold_hold and
                   is_nil(block.resolved_at)
             )
           )

    assert Repo.get!(Item, item_id).status == :resolved
  end

  test "concurrent reports crossing the threshold create one active hold" do
    {community, article, _attrs, _author} = mock_article(:post)

    reporters =
      Enum.map(1..4, fn _ ->
        {:ok, user} = db_insert(:user)
        user
      end)

    tasks =
      Enum.map(reporters, fn reporter ->
        Task.async(fn ->
          receive do
            :submit ->
              GroupherServer.AlertWall.Commands.SubmitReport.execute(
                %{
                  owner: :cms,
                  target_type: :article,
                  target_id: article.id,
                  community_id: community.id,
                  observed_version: 1
                },
                :spam,
                "concurrent threshold",
                reporter,
                Ecto.UUID.generate()
              )
          end
        end)
      end)

    Enum.each(tasks, fn %Task{pid: pid} -> Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), pid) end)
    Enum.each(tasks, &send(&1.pid, :submit))
    results = Enum.map(tasks, &Task.await(&1, 15_000))
    assert Enum.all?(results, &match?({:ok, _}, &1))

    assert Repo.aggregate(
             from(block in ArticleReviewBlock,
               where:
                 block.article_id == ^article.id and block.community_id == ^community.id and
                   block.type == :report_threshold_hold and is_nil(block.resolved_at)
             ),
             :count
           ) == 1

    assert Repo.aggregate(
             from(report in UserReport,
               where:
                 report.target_id == ^article.id and report.target_type == :article and
                   report.community_id == ^community.id
             ),
             :count
           ) == 4
  end

  test "threshold block write failure rolls back the crossing report" do
    {community, article, _attrs, _author} = mock_article(:post)

    prior_report_count = CMS.Review.Config.report_threshold() - 1

    Enum.each(1..prior_report_count, fn _ ->
      {:ok, reporter} = db_insert(:user)

      assert {:ok, _} =
               GroupherServer.AlertWall.Commands.SubmitReport.execute(
                 %{
                   owner: :cms,
                   target_type: :article,
                   target_id: article.id,
                   community_id: community.id,
                   observed_version: 1
                 },
                 :spam,
                 "before threshold",
                 reporter,
                 Ecto.UUID.generate()
               )
    end)

    Repo.query!("""
    CREATE FUNCTION cms.fail_threshold_block_test() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.type = 'report_threshold_hold' THEN
        RAISE EXCEPTION 'injected threshold block failure';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    Repo.query!("""
    CREATE TRIGGER fail_threshold_block_test
    BEFORE INSERT ON cms.article_review_blocks
    FOR EACH ROW EXECUTE FUNCTION cms.fail_threshold_block_test()
    """)

    {:ok, reporter} = db_insert(:user)

    assert {:error, _} =
             GroupherServer.AlertWall.Commands.SubmitReport.execute(
               %{
                 owner: :cms,
                 target_type: :article,
                 target_id: article.id,
                 community_id: community.id,
                 observed_version: 1
               },
               :spam,
               "crossing threshold",
               reporter,
               Ecto.UUID.generate()
             )

    assert Repo.aggregate(
             from(report in UserReport,
               where:
                 report.target_id == ^article.id and report.target_type == :article and
                   report.community_id == ^community.id
             ),
             :count
           ) == prior_report_count

    refute Repo.exists?(
             from(block in ArticleReviewBlock,
               where: block.article_id == ^article.id and block.type == :report_threshold_hold
             )
           )
  end

  test "reject clears a report threshold hold before applying the manual hold" do
    {community, article, _attrs, _author} = mock_article(:post)

    reports =
      Enum.map(1..CMS.Review.Config.report_threshold(), fn _ ->
        {:ok, reporter} = db_insert(:user)

        assert {:ok, report} =
                 GroupherServer.AlertWall.Commands.SubmitReport.execute(
                   %{
                     owner: :cms,
                     target_type: :article,
                     target_id: article.id,
                     community_id: community.id,
                     observed_version: 1
                   },
                   :spam,
                   "threshold review",
                   reporter,
                   Ecto.UUID.generate()
                 )

        report
      end)

    {:ok, moderator} = db_insert(:user)

    moderator = %{
      moderator
      | cur_passport: %{"global" => %{}, community.slug => %{"cms" => %{"review.decide" => true}}}
    }

    assert {:ok, _} =
             CMS.decide_review_target(
               "article:#{article.id}",
               "community:#{community.id}",
               :reject,
               moderator,
               Ecto.UUID.generate()
             )

    refute Repo.exists?(
             from(block in ArticleReviewBlock,
               where:
                 block.article_id == ^article.id and block.type == :report_threshold_hold and
                   is_nil(block.resolved_at)
             )
           )

    assert Repo.exists?(
             from(block in ArticleReviewBlock,
               where:
                 block.article_id == ^article.id and block.type == :manual_hold and
                   is_nil(block.resolved_at)
             )
           )

    assert Repo.get!(Item, List.last(reports).item_id).status == :resolved
  end

  test "the report threshold for a Post Comment uses platform scope across reporting Communities" do
    {origin, post, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        origin,
        :post,
        article_inner_id(post, origin),
        mock_comment("reported comment"),
        author,
        Ecto.UUID.generate()
      )

    reporting_communities =
      Enum.map(1..3, fn _ ->
        {:ok, community} = mock_community(author)
        community
      end)

    reports =
      Enum.zip(
        reporting_communities,
        Enum.map(1..3, fn _ ->
          {:ok, reporter} = db_insert(:user)
          reporter
        end)
      )
      |> Enum.map(fn {reporting_community, reporter} ->
        assert {:ok, report} =
                 GroupherServer.AlertWall.Commands.SubmitReport.execute(
                   %{
                     owner: :cms,
                     target_type: :comment,
                     target_id: to_string(comment.id),
                     community_id: nil,
                     reported_in_community_id: reporting_community.id,
                     observed_version: 1
                   },
                   :spam,
                   "Please review this comment",
                   reporter,
                   Ecto.UUID.generate()
                 )

        report
      end)

    item_id = List.last(reports).item_id
    source_ref = "report_threshold:item:#{item_id}"

    assert %CommentReviewBlock{
             community_id: nil,
             type: :report_threshold_hold,
             source: :domain,
             source_ref: ^source_ref,
             resolved_at: nil
           } = Repo.get_by!(CommentReviewBlock, comment_id: comment.id)
  end

  test "the report threshold for a Doc Comment uses its origin Community scope" do
    {community, doc, _attrs, author} = mock_article(:doc)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :doc,
        article_inner_id(doc, community),
        mock_comment("reported doc comment"),
        author,
        Ecto.UUID.generate()
      )

    reports =
      Enum.map(1..3, fn _ ->
        {:ok, reporter} = db_insert(:user)

        assert {:ok, report} =
                 GroupherServer.AlertWall.Commands.SubmitReport.execute(
                   %{
                     owner: :cms,
                     target_type: :comment,
                     target_id: to_string(comment.id),
                     community_id: community.id,
                     reported_in_community_id: community.id,
                     observed_version: 1
                   },
                   :spam,
                   "Please review this doc comment",
                   reporter,
                   Ecto.UUID.generate()
                 )

        report
      end)

    source_ref = "report_threshold:item:#{List.last(reports).item_id}"

    assert %CommentReviewBlock{
             community_id: community_id,
             type: :report_threshold_hold,
             source: :domain,
             source_ref: ^source_ref,
             resolved_at: nil
           } = Repo.get_by!(CommentReviewBlock, comment_id: comment.id)

    assert community_id == community.id
  end

  test "the report threshold for a Doc uses platform scope" do
    {_community, doc, _attrs, _author} = mock_article(:doc)
    target_id = "#{doc.id}:#{doc.branch_id}"

    reports =
      Enum.map(1..3, fn _ ->
        {:ok, reporter} = db_insert(:user)

        assert {:ok, report} =
                 GroupherServer.AlertWall.Commands.SubmitReport.execute(
                   %{
                     owner: :cms,
                     target_type: :doc,
                     target_id: target_id,
                     community_id: nil,
                     observed_version: 1
                   },
                   :spam,
                   "Please review this doc",
                   reporter,
                   Ecto.UUID.generate()
                 )

        report
      end)

    source_ref = "report_threshold:item:#{List.last(reports).item_id}"

    assert %DocReviewBlock{
             type: :report_threshold_hold,
             source: :domain,
             source_ref: ^source_ref,
             resolved_at: nil
           } = Repo.get_by!(DocReviewBlock, article_id: doc.id, branch_id: doc.branch_id)
  end

  test "an account report does not apply a CMS content restriction" do
    {:ok, reporter} = db_insert(:user)
    {:ok, reported_user} = db_insert(:user)

    assert {:ok, _report} =
             GroupherServer.AlertWall.Commands.SubmitReport.execute(
               %{owner: :accounts, target_type: :user, target_id: to_string(reported_user.id)},
               :spam,
               "Please review this account",
               reporter,
               Ecto.UUID.generate()
             )

    assert Repo.aggregate(ArticleReviewBlock, :count, :id) == 0
  end

  test "review block SQL vocabularies match the canonical enum values" do
    definitions =
      Repo.query!("""
      SELECT conname, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conname IN (
        'cms_review_restriction_type_check',
        'cms_review_restriction_source_check'
      )
      """).rows

    type_definitions =
      Enum.filter(definitions, fn [name, _] -> name == "cms_review_restriction_type_check" end)

    source_definitions =
      Enum.filter(definitions, fn [name, _] -> name == "cms_review_restriction_source_check" end)

    assert length(type_definitions) == 3
    assert length(source_definitions) == 3

    assert Enum.all?(type_definitions, fn [_name, definition] ->
             sql_values(definition) ==
               Enum.sort_by(CMS.Review.Const.restriction_types(), &Atom.to_string/1)
           end)

    assert Enum.all?(source_definitions, fn [_name, definition] ->
             sql_values(definition) ==
               Enum.sort_by(CMS.Review.Const.restriction_sources(), &Atom.to_string/1)
           end)
  end

  test "vocabulary migration guard rejects a retired persisted hold" do
    {_community, article, _attrs, _author} = mock_article(:post)

    {:ok, _block} =
      %ArticleReviewBlock{}
      |> ArticleReviewBlock.changeset(%{
        article_id: article.id,
        type: :manual_hold,
        source_ref: "guard-test:#{Ecto.UUID.generate()}",
        source: :domain,
        applied_at: DateTime.utc_now(:second),
        version: 1
      })
      |> Repo.insert()

    Repo.query!(
      "ALTER TABLE cms.article_review_blocks DROP CONSTRAINT cms_review_restriction_type_check"
    )

    Repo.query!(
      "UPDATE cms.article_review_blocks SET type = 'awaiting_ai' WHERE article_id = $1",
      [Ecto.UUID.dump!(article.id)]
    )

    assert_raise RuntimeError, ~r/retired type\/source values/, fn ->
      CMS.Review.VocabularyGuard.assert_current!()
    end
  end

  test "V2 cutover preflight counts current holds, requests and open Wall items" do
    {community, article, _attrs, _author} = mock_article(:post)

    assert Repo.exists?(
             from(request in ArtimentReview,
               where:
                 request.article_id == ^article.id and request.state in [:queued, :running] and
                   is_nil(request.replaced_at) and is_nil(request.outdated_at)
             )
           )

    {:ok, reporter} = db_insert(:user)

    assert {:ok, _report} =
             GroupherServer.AlertWall.Commands.SubmitReport.execute(
               %{
                 owner: :cms,
                 target_type: :article,
                 target_id: article.id,
                 community_id: community.id,
                 observed_version: 1
               },
               :spam,
               "preflight",
               reporter,
               Ecto.UUID.generate()
             )

    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)

    assert {:ok, {:ok, _block}} =
             Repo.transaction(fn ->
               CMS.ReviewBlocks.apply(lifecycle, %{
                 scope_key: "platform",
                 type: :manual_hold,
                 source: :human,
                 source_ref: "preflight:#{Ecto.UUID.generate()}",
                 operation_ref: Ecto.UUID.generate(),
                 applied_at: DateTime.utc_now(:second)
               })
             end)

    output =
      capture_io(fn ->
        assert_raise Mix.Error, fn -> Mix.Tasks.ReviewBot.V2.Preflight.run([]) end
      end)

    assert output =~ "\"article_review_blocks\": 1"
    assert output =~ "\"active_restriction_count\": 1"
    assert %{"pending_target_count" => count} = Jason.decode!(output)
    assert count >= 2
  end

  test "recheck registers a new current request through the CMS Receipt command" do
    {community, article, _attrs, _author} = mock_article(:post)
    {:ok, reviewer} = db_insert(:user)

    reviewer = %{
      reviewer
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.decide" => true}}
        }
    }

    before_ids =
      Repo.all(
        from(request in ArtimentReview,
          where: request.article_id == ^article.id,
          select: request.id
        )
      )

    assert {:ok, result} =
             CMS.recheck_review_target(
               "article:#{article.id}",
               "community:#{community.id}",
               reviewer,
               Ecto.UUID.generate()
             )

    assert result.action == :recheck
    assert result.target_type == :article
    assert result.target_id == article.id
    assert result.request_count == 1

    requests =
      Repo.all(
        from(request in ArtimentReview,
          where: request.article_id == ^article.id and request.id not in ^before_ids
        )
      )

    assert [%ArtimentReview{community_id: community_id}] = requests
    assert community_id == community.id
  end

  test "platform Comment recheck registers only the platform policy request" do
    {community, article, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment("public comment"),
        author,
        Ecto.UUID.generate()
      )

    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.decide" => true}}}

    before_ids =
      Repo.all(
        from(request in ArtimentReview,
          where: request.comment_id == ^comment.id,
          select: request.id
        )
      )

    assert {:ok, result} =
             CMS.recheck_review_target(
               "comment:#{comment.id}",
               "platform",
               reviewer,
               Ecto.UUID.generate()
             )

    assert result.request_count == 1

    requests =
      Repo.all(
        from(request in ArtimentReview,
          where: request.comment_id == ^comment.id and request.id not in ^before_ids
        )
      )

    assert [%ArtimentReview{community_id: nil}] = requests
  end

  test "platform Comment recheck does not require a community policy" do
    {community, article, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment("public comment"),
        author,
        Ecto.UUID.generate()
      )

    Repo.delete!(
      Repo.get_by!(ReviewBotConfig,
        community_id: community.id,
        subject_type: :comment
      )
    )

    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.decide" => true}}}

    assert {:ok, result} =
             CMS.recheck_review_target(
               "comment:#{comment.id}",
               "platform",
               reviewer,
               Ecto.UUID.generate()
             )

    assert result.request_count == 1
  end

  defp sql_values(definition) do
    Regex.scan(~r/'([^']+)'/, definition, capture: :all_but_first)
    |> List.flatten()
    |> Enum.map(&String.to_existing_atom/1)
    |> Enum.sort_by(&Atom.to_string/1)
  end
end
