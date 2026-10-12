import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, access, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openStore } from "../server/store.mjs";
import {
  createReplayLifecycle,
  workspaceReplays,
} from "../server/replay-workspace.mjs";

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "studio-workspace-"));
  const store = openStore(dir);
  t.after(async () => {
    store.close();
    await rm(dir, { recursive: true, force: true });
  });
  await mkdir(path.join(dir, "library"));
  const original = path.join(dir, "original.osr");
  await writeFile(original, "original");
  async function replay(letter, uploadId = "first") {
    const id = letter.repeat(64),
      file = path.join(dir, "library", `${id}.osr`);
    await writeFile(file, "copy");
    return store.put("replay", {
      id,
      path: file,
      mapHash: letter.repeat(32),
      uploadId,
    });
  }
  return { store, replay, original, ...createReplayLifecycle(store, dir) };
}

test("new render detaches active copies, preserves queue snapshots and permits another workspace", async (t) => {
  const f = await fixture(t),
    a = await f.replay("a"),
    unused = await f.replay("b");
  for (const status of ["running", "queued"])
    f.store.put("job", {
      id: status,
      status,
      project: { replayIds: [a.id], rules: { mode: 3 } },
      config: { outputDir: "snapshot" },
    });
  f.store.put("job", {
    id: "preview",
    status: "completed",
    project: { replayIds: [unused.id] },
    retryable: true,
  });
  f.store.put("job", {
    id: "dance",
    status: "completed",
    project: { replayIds: [] },
    retryable: true,
  });
  await f.clearReplays();
  assert.deepEqual(workspaceReplays(f.store), []);
  await access(a.path);
  await assert.rejects(access(unused.path));
  for (const id of ["running", "queued"]) {
    assert.deepEqual(f.store.get("job", id).project.rules, { mode: 3 });
    assert.equal(f.store.get("job", id).config.outputDir, "snapshot");
  }
  assert.equal(f.store.get("job", "preview").retryable, false);
  assert.equal(f.store.get("job", "dance").retryable, true);
  const next = await f.replay("c");
  assert.deepEqual(
    workspaceReplays(f.store).map((r) => r.id),
    [next.id],
  );
  await access(f.original);
});

test("successful video removes consumed copies only after dependent jobs finish", async (t) => {
  const f = await fixture(t),
    a = await f.replay("a");
  f.store.put("job", {
    id: "record",
    status: "completed",
    action: "record",
    consumedReplayIds: [a.id],
    replayUploads: { [a.id]: a.uploadId },
  });
  f.store.put("job", {
    id: "queued",
    status: "queued",
    project: { replayIds: [a.id] },
  });
  await f.clearReplays();
  await f.collectReplays();
  await access(a.path);
  f.store.put("job", {
    id: "queued",
    status: "completed",
    action: "preview",
    project: { replayIds: [a.id] },
    retryable: true,
  });
  await f.collectReplays();
  await assert.rejects(access(a.path));
  assert.equal(f.store.get("job", "queued").retryable, false);
  await access(f.original);
});

test("an earlier video cannot delete a replay uploaded again for a new render", async (t) => {
  const f = await fixture(t),
    a = await f.replay("a");
  f.store.put("job", {
    id: "old",
    status: "running",
    project: { replayIds: [a.id] },
  });
  await f.clearReplays();
  f.store.put("replay", { ...a, workspace: true, uploadId: "second" });
  f.store.put("job", {
    id: "old",
    status: "completed",
    action: "record",
    consumedReplayIds: [a.id],
    replayUploads: { [a.id]: "first" },
  });
  await f.collectReplays();
  await access(a.path);
  assert.equal(workspaceReplays(f.store).length, 1);
  assert.deepEqual(f.store.get("job", "old").consumedReplayIds, []);
  f.store.put("job", {
    id: "new",
    status: "completed",
    action: "record",
    consumedReplayIds: [a.id],
    replayUploads: { [a.id]: "second" },
  });
  await f.collectReplays();
  assert.equal(f.store.get("replay", a.id), null);
});

test("preview, failure and cancellation retain detached replay copies for retry", async (t) => {
  const f = await fixture(t);
  for (const [i, status] of ["completed", "failed", "cancelled"].entries()) {
    const a = await f.replay(["a", "b", "c"][i]);
    f.store.put("replay", { ...a, workspace: false });
    f.store.put("job", {
      id: status,
      status,
      action: status === "completed" ? "preview" : "record",
      project: { replayIds: [a.id] },
      retryable: true,
    });
  }
  await f.collectReplays();
  assert.equal(f.store.list("replay").length, 3);
  assert.ok(f.store.list("job").every((j) => j.retryable));
  await f.clearReplays();
  assert.equal(f.store.list("replay").length, 0);
});

test("concurrent upload waits for collection and survives a preceding failed operation", async (t) => {
  const f = await fixture(t),
    a = await f.replay("a");
  f.store.put("job", {
    id: "record",
    status: "completed",
    action: "record",
    consumedReplayIds: [a.id],
    replayUploads: { [a.id]: a.uploadId },
  });
  const collection = f.collectReplays();
  const upload = f.withReplayLock(() => f.replay("a", "second"));
  await Promise.all([collection, upload]);
  await access(a.path);
  assert.equal(f.store.get("replay", a.id).uploadId, "second");
  await assert.rejects(
    f.withReplayLock(() => {
      throw new Error("invalid upload");
    }),
  );
  await f.withReplayLock(() => f.replay("b"));
  assert.equal(workspaceReplays(f.store).length, 2);
});
