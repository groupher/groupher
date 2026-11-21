defmodule GroupherServer.Test.CMS.Articles.ArticleBindingTrashSchemaTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleBinding, ArticleBindingTrash}

  test "trash identity is unique, scoped to its binding and restricts binding deletion" do
    {community, public, _, actor} = mock_article(:post)
    {:ok, other_community} = mock_community(actor)

    binding =
      Repo.get_by!(ArticleBinding, article_id: public.id, community_id: community.id)

    attrs = %{
      community_id: community.id,
      article_id: public.id,
      binding_id: binding.id,
      actor_id: actor.id,
      hidden_at: DateTime.utc_now(:second)
    }

    assert {:error, mismatch} =
             %ArticleBindingTrash{}
             |> ArticleBindingTrash.changeset(%{attrs | community_id: other_community.id})
             |> Repo.insert(mode: :savepoint)
    assert Keyword.has_key?(mismatch.errors, :binding_id)

    assert {:ok, row} =
             %ArticleBindingTrash{} |> ArticleBindingTrash.changeset(attrs) |> Repo.insert()

    assert row.revision == 1

    assert {:error, _} =
             %ArticleBindingTrash{}
             |> ArticleBindingTrash.changeset(attrs)
             |> Repo.insert(mode: :savepoint)

    assert {:error, %Postgrex.Error{}} =
             Ecto.Adapters.SQL.query(
               Repo,
               "DELETE FROM cms.article_bindings WHERE id = $1",
               [binding.id], mode: :savepoint)

    assert Repo.exists?(from(b in ArticleBinding, where: b.id == ^binding.id))
  end
end
