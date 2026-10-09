import path from "node:path";
import { rm } from "node:fs/promises";

export const workspaceReplays = (store) =>
  store.list("replay").filter((r) => r.workspace !== false);

export function createReplayLifecycle(store, dataDir) {
  // File deletion yields to other requests: serialize uploads, resets and collection.
  let pending = Promise.resolve();
  function withReplayLock(fn) {
    const result = pending.then(fn);
    pending = result.catch(() => {});
    return result;
  }
  async function removeReplay(id) {
    const replay = store.get("replay", id);
    if (!replay) return;
    const expected = path.join(dataDir, "library", `${id}.osr`);
    if (
      !/^[a-f\d]{64}$/i.test(id) ||
      path.resolve(replay.path) !== path.resolve(expected)
    )
      throw new Error("Нельзя удалить файл за пределами временных реплеев");
    await rm(expected, { force: true });
    store.remove("replay", id);
  }
  async function clearReplays() {
    const protectedIds = new Set(
      store
        .list("job")
        .filter((j) => ["queued", "running"].includes(j.status))
        .flatMap((j) => j.project?.replayIds ?? []),
    );
    for (const replay of store.list("replay")) {
      if (protectedIds.has(replay.id))
        store.put("replay", { ...replay, workspace: false });
      else await removeReplay(replay.id);
    }
    for (const job of store.list("job"))
      if (
        !["queued", "running"].includes(job.status) &&
        job.project?.replayIds.some((id) => !store.get("replay", id))
      )
        store.put("job", {
          ...job,
          project: null,
          config: null,
          retryable: false,
        });
    return { ok: true };
  }
  async function collectReplays() {
    const jobs = store.list("job"),
      eligible = new Set(
        jobs
          .filter((j) => j.status === "completed" && j.action === "record")
          .flatMap((j) =>
            (j.consumedReplayIds ?? []).filter((id) => {
              const replay = store.get("replay", id);
              return (
                replay &&
                (replay.uploadId ?? null) === (j.replayUploads?.[id] ?? null)
              );
            }),
          ),
      );
    const protectedIds = new Set(
      jobs
        .filter((j) => ["queued", "running"].includes(j.status))
        .flatMap((j) => j.project?.replayIds ?? []),
    );
    for (const id of eligible)
      if (!protectedIds.has(id)) await removeReplay(id);
    for (const old of jobs) {
      const patch = {};
      if (old.consumedReplayIds)
        patch.consumedReplayIds = old.consumedReplayIds.filter(
          (id) =>
            store.get("replay", id) &&
            (store.get("replay", id).uploadId ?? null) ===
              (old.replayUploads?.[id] ?? null),
        );
      if (
        old.project &&
        !["queued", "running"].includes(old.status) &&
        old.project.replayIds.some((id) => !store.get("replay", id))
      )
        Object.assign(patch, { project: null, config: null, retryable: false });
      if (Object.keys(patch).length) store.put("job", { ...old, ...patch });
    }
  }
  return {
    clearReplays: () => withReplayLock(clearReplays),
    collectReplays: () => withReplayLock(collectReplays),
    withReplayLock,
  };
}
