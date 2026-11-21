defmodule GroupherServer.Test.CMS.Articles.CommunityArticleTrashContractTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.{Articles.CommunityTrashQuery, CommunityArticleTrashContract, Model.Community}
  alias GroupherServerWeb.Schema

  test "shared thread contract matches GraphQL input, item and adapter dispatch" do
    path =
      Path.expand("../../packages/contracts/community-article-trash.contract.json", File.cwd!())

    %{"threads" => threads} = path |> File.read!() |> Jason.decode!()
    expected = Enum.map(threads, &String.to_existing_atom/1)
    assert CommunityArticleTrashContract.threads() == expected

    enum = Absinthe.Schema.lookup_type(Schema, :community_article_trash_thread)
    assert Enum.sort(Map.keys(enum.values)) == Enum.sort(expected)
    interface = Absinthe.Schema.lookup_type(Schema, :community_article_trash_item)
    assert interface.fields.thread.type.of_type == :community_article_trash_thread

    for thread <- [:post, :blog, :changelog] do
      assert {:error, %{reason: :permission_denied}} =
               CommunityTrashQuery.page(%Community{}, nil, thread, nil)
    end

    for thread <- [:doc, :ticket] do
      assert {:error, %{reason: :unsupported_community_trash_thread}} =
               CommunityTrashQuery.page(%Community{}, nil, thread, nil)
    end
  end
end
