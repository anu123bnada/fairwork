import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  })),
}));

import { offerCommand } from "@/server/offer";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "40000000-0000-4000-8000-000000000013", is_anonymous: false } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { status: "awaiting_other_party" }, error: null });
});

describe("database-backed Day 3 command transport", () => {
  it("sends validated commands to the named API RPC after authenticating the session", async () => {
    const payload = {
      offerId: "40000000-0000-4000-8000-000000000021",
      requesterId: "client-controlled-value",
      requesterRole: "EMPLOYER",
    };

    await expect(offerCommand("review_offer", payload)).resolves.toEqual({ status: "awaiting_other_party" });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("review_offer", { payload });
  });

  it("does not call a database RPC for an absent or anonymous identity", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(offerCommand("confirm_agreement", {})).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "anonymous", is_anonymous: true } }, error: null });
    await expect(offerCommand("confirm_agreement", {})).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps database authorization failures without returning database detail", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "ACTION_FORBIDDEN" } });
    await expect(offerCommand("review_offer", {})).rejects.toMatchObject({ code: "ACTION_FORBIDDEN", status: 403 });
  });
});
