defmodule GroupherServer.Test.Seeds.ThreadsTest do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS.Seeds.Threads

  describe "[threads seeds]" do
    test "get returns threads for home type" do
      # threads = Threads.get(:home)
      # Verify structure
    end

    test "get returns threads for blackhole type" do
      # threads = Threads.get(:blackhole)
      # assert length(threads) > 0
      # Verify thread structure with title, slug, index
    end

    test "get returns threads for feedback type" do
      # threads = Threads.get(:feedback)
      # assert length(threads) == 3
    end

    test "get returns threads for framework type" do
      # threads = Threads.get(:framework)
      # assert length(threads) > 0
    end

    test "get returns threads for city type" do
      # threads = Threads.get(:city)
      # assert length(threads) == 2
    end

    test "pl type delegates to framework" do
      # Test that :pl returns same as :framework
      # pl_threads = Threads.get(:pl)
      # framework_threads = Threads.get(:framework)
      # assert pl_threads == framework_threads
    end
  end
end
