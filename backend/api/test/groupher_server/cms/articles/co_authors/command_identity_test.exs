defmodule GroupherServer.Test.CMS.Articles.CoAuthors.CommandIdentityTest do
  use GroupherServer.TestMate, async: true

  alias GroupherServer.CMS
  alias CMS.Command.IntentCodec

  test "co-author command identities retain selectors and redact permission maps" do
    create = %{
      subject_user_id: 42,
      request_type: :invite,
      permissions: %{"article.update" => true}
    }

    assert {:ok, encoded_create} = IntentCodec.encode(:article_co_author_request_create, create)
    assert encoded_create["subject_user_id"] == 42
    assert encoded_create["request_type"] == "invite"
    assert encoded_create["permissions"]["article.update"]["__redacted__"]
    refute encoded_create["permissions"]["article.update"] == true

    assert {:ok, encoded_decide} =
             IntentCodec.encode(:article_co_author_request_decide, %{
               request_id: Ecto.UUID.generate(),
               revision: 3,
               decision: :accept,
               approved: %{"article.update" => true}
             })

    assert encoded_decide["revision"] == 3
    assert encoded_decide["approved"]["__redacted__"]

    for {operation, params} <- [
          {:article_co_author_request_cancel, %{request_id: Ecto.UUID.generate(), revision: 2}},
          {:article_co_author_permissions_update,
           %{
             member_id: Ecto.UUID.generate(),
             revision: 1,
             permissions: %{"article.update" => true}
           }},
          {:article_co_author_member_remove, %{member_id: Ecto.UUID.generate(), revision: 1}},
          {:article_co_author_member_leave, %{revision: 1}}
        ] do
      assert {:ok, _} = IntentCodec.encode(operation, params)
    end

    assert {:error, :invalid_intent_params} =
             IntentCodec.encode(:article_co_author_request_create, %{})
  end
end
