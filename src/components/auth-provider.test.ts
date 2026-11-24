import { describe, expect, it } from "vitest";
import { reconcileAuthUser, type AuthUser } from "./auth-provider";

const user: AuthUser = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  avatarUrl: null,
  profileCompleted: false,
};

describe("reconcileAuthUser", () => {
  it("preserves identity when all fields match", () => {
    expect(reconcileAuthUser(user, { ...user })).toBe(user);
  });

  it("preserves identity with nullable fields", () => {
    const previous = { ...user, name: null, email: null };
    expect(reconcileAuthUser(previous, { ...previous })).toBe(previous);
  });

  it.each([
    { id: "user-2" },
    { name: null },
    { email: null },
    { avatarUrl: "https://example.com/avatar.png" },
    { profileCompleted: true },
  ])("uses the next user when a field changes: %o", (change) => {
    const next = { ...user, ...change };
    expect(reconcileAuthUser(user, next)).toBe(next);
  });

  it("handles sign-in and sign-out transitions", () => {
    expect(reconcileAuthUser(null, user)).toBe(user);
    expect(reconcileAuthUser(user, null)).toBeNull();
    expect(reconcileAuthUser(null, null)).toBeNull();
  });
});
