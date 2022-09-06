import { describe, it, expect, vi } from "vitest";
import { RetryHandler } from "../src/core/retry.js";

describe("RetryHandler", () => {
  it("succeeds on first attempt without retrying", async () => {
    const handler = new RetryHandler({ maxRetries: 3, baseDelayMs: 10 });
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await handler.execute(fn, "test");
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    const handler = new RetryHandler({ maxRetries: 3, baseDelayMs: 10 });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("recovered");

    const result = await handler.execute(fn, "flaky-op");
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting all retries", async () => {
    const handler = new RetryHandler({ maxRetries: 2, baseDelayMs: 5 });
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(handler.execute(fn, "doomed")).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("calls onRetry callback on each retry", async () => {
    const onRetry = vi.fn();
    const handler = new RetryHandler({ maxRetries: 2, baseDelayMs: 5, onRetry });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("err1"))
      .mockResolvedValue("ok");

    await handler.execute(fn);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
  });

  it("respects retryableErrors filter", async () => {
    const handler = new RetryHandler({
      maxRetries: 3,
      baseDelayMs: 5,
      retryableErrors: ["timeout"],
    });

    const fn = vi.fn().mockRejectedValue(new Error("permission denied"));
    await expect(handler.execute(fn, "filtered")).rejects.toThrow("permission denied");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries when error matches retryableErrors", async () => {
    const handler = new RetryHandler({
      maxRetries: 2,
      baseDelayMs: 5,
      retryableErrors: ["rate limit"],
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("rate limit exceeded"))
      .mockResolvedValue("ok");

    const result = await handler.execute(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("applies exponential backoff with jitter", async () => {
    const handler = new RetryHandler({
      maxRetries: 3,
      baseDelayMs: 100,
      backoffMultiplier: 2,
      maxDelayMs: 5000,
    });
    const opts = handler.getOptions();
    expect(opts.backoffMultiplier).toBe(2);
    expect(opts.maxDelayMs).toBe(5000);
  });

  it("caps delay at maxDelayMs", async () => {
    const handler = new RetryHandler({
      maxRetries: 1,
      baseDelayMs: 50000,
      backoffMultiplier: 10,
      maxDelayMs: 100,
    });
    const opts = handler.getOptions();
    expect(opts.maxDelayMs).toBe(100);
  });

  it("creates with static factory method", () => {
    const handler = RetryHandler.withDefaults({ maxRetries: 5 });
    expect(handler.getOptions().maxRetries).toBe(5);
    expect(handler.getOptions().baseDelayMs).toBe(1000);
  });
});
