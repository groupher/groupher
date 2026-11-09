defmodule GroupherServer.Test.CMS.Articles.DocActivityTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query
  alias GroupherServer.{CMS, Pagi, Repo}
  alias CMS.Model.{Article, ArticleBinding, DocBranch, DocBranchState, DocPublic}
  alias CMS.Articles.Pagination
  alias Pagi.Params
  alias Helper.ORM.Pagi.Config

  test "ACT-01 display, ASC/DESC cursor and binding tie use the effective main activity" do
    {community, first, _, author} = mock_article(:doc)
    {_, second, _, _} = mock_article(:doc, community, author)
    t1 = ~U[2026-11-01 00:00:00Z]
    t3 = ~U[2026-11-03 00:00:00Z]
    t4 = ~U[2026-11-04 00:00:00Z]
    t5 = ~U[2026-11-05 00:00:00Z]
    ids = [first.article_id, second.article_id]
    Repo.update_all(from(a in Article, where: a.id in ^ids), set: [active_at: t3])
    Repo.update_all(from(s in DocBranchState, where: s.article_id in ^ids), set: [active_at: t1])

    preview =
      Repo.insert!(
        DocBranch.changeset(%DocBranch{}, %{
          community_id: community.id,
          slug: "activity-preview",
          title: "Preview",
          type: :preview,
          status: :active
        })
      )

    Repo.insert!(
      DocBranchState.changeset(%DocBranchState{}, %{
        article_id: first.article_id,
        branch_id: preview.id,
        active_at: t4
      })
    )

    config = %Config{
      api: :cursor,
      default_size: 1,
      max_size: 10,
      revision: 0,
      platform_hard_max: 100
    }

    for {sort, expected} <- [{:asc_active, ids}, {:desc_active, Enum.reverse(ids)}] do
      {:ok, one} =
        Pagination.page(:doc, %{community: community.slug, sort: sort}, nil, nil, config: config)

      assert [head] = one.entries
      assert head.id == hd(expected)
      assert head.active_at == t3
      assert head.status == :published

      {:ok, two} =
        Pagination.page(
          :doc,
          %{community: community.slug, sort: sort},
          %Params.Cursor{first: 1, after: one.page_info.end_cursor, config_revision: 0},
          nil,
          config: config
        )

      assert [tail] = two.entries
      assert tail.id == List.last(expected)
      assert tail.active_at == t3
      refute two.page_info.has_next_page
    end

    Repo.update_all(
      from(s in DocBranchState,
        where: s.article_id == ^first.article_id and s.branch_id == ^first.branch_id
      ),
      set: [active_at: t5]
    )

    {:ok, %{entries: [updated]}} =
      Pagination.page(:doc, %{community: community.slug, sort: :desc_active}, nil, nil,
        config: config
      )

    assert updated.id == first.article_id
    assert updated.active_at == t5

    Repo.update_all(
      from(s in DocBranchState,
        where: s.article_id == ^first.article_id and s.branch_id == ^first.branch_id
      ),
      set: [is_sunk: true, active_at: t1]
    )

    {:ok, %{entries: sunk_entries}} =
      Pagination.page(:doc, %{community: community.slug, sort: :asc_active}, nil, nil,
        config: %{config | default_size: 10}
      )

    assert Enum.find(sunk_entries, &(&1.id == first.article_id)).active_at == t1
  end

  test "ACT-04 the retained Article Flop adapter orders by the same effective expression" do
    {community, first, _, author} = mock_article(:doc)
    {_, second, _, _} = mock_article(:doc, community, author)

    Repo.update_all(from(a in Article, where: a.id == ^first.article_id),
      set: [active_at: ~U[2026-11-05 00:00:00Z]]
    )

    Repo.update_all(from(s in DocBranchState, where: s.article_id == ^first.article_id),
      set: [active_at: ~U[2026-11-01 00:00:00Z]]
    )

    Repo.update_all(from(a in Article, where: a.id == ^second.article_id),
      set: [active_at: ~U[2026-11-02 00:00:00Z]]
    )

    Repo.update_all(from(s in DocBranchState, where: s.article_id == ^second.article_id),
      set: [active_at: ~U[2026-11-03 00:00:00Z]]
    )

    query =
      from(a in Article,
        as: :article,
        join: binding in ArticleBinding,
        as: :article_binding,
        on: binding.article_id == a.id,
        join: state in DocBranchState,
        as: :stable_doc_state,
        on: state.article_id == a.id and state.branch_id == ^first.branch_id,
        join: public in DocPublic,
        as: :stable_public,
        on: public.article_id == a.id and public.branch_id == state.branch_id,
        where: binding.community_id == ^community.id
      )

    {entries, _meta} =
      Flop.run(
        query,
        %Flop{
          limit: 20,
          offset: 0,
          order_by: [:doc_active_at, :binding_id],
          order_directions: [:desc, :desc]
        },
        for: Article,
        repo: Repo
      )

    assert Enum.map(entries, & &1.id) == [first.article_id, second.article_id]
  end
end
