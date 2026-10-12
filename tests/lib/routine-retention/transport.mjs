// New synthetic tenant-test transport only. No server, provider or existing helper changes.
import { randomUUID, createHash } from 'node:crypto';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const retainedHeaders = ['cache-control', 'content-type', 'content-disposition', 'x-saha-export-id', 'x-saha-content-sha256', 'x-saha-manifest-sha256', 'x-saha-request-id'];

/** One deadline covers headers and every body read. No retry or substituted response. */
export async function boundedTenantRequest(base, path, init = {}, {
  timeoutMs = 15000, fetchImpl = globalThis.fetch, onEvidence, maxResponseBytes = 16 * 1024 * 1024,
} = {}) {
  const origin = new URL(base), url = new URL(path, origin);
  if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)
      || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash
      || typeof path !== 'string' || !path.startsWith('/') || url.origin !== origin.origin
      || url.username || url.password || url.hash) throw new Error('Tenant transport requires one synthetic loopback origin');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) throw new Error('Invalid tenant request deadline');
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) throw new Error('Invalid tenant response custody bound');
  const controller = new AbortController(), requestId = randomUUID(), started = performance.now(), chunks = [];
  const deadlineAt = started + timeoutMs;
  let reader, timer, response, headerMs, bytes = 0, timedOut = false;
  const receipt = { requestId, method: init.method ?? 'GET', path, timeoutMs, status: 'running', phase: 'fetch',
    actualHttpStatus: null, partialBodyBytes: 0, completeBody: false, cancelRequested: false };
  const snapshot = () => {
    const body = Buffer.concat(chunks);
    return { ...receipt, partialBodyBytes: body.length, partialBodyBase64: body.toString('base64'),
      partialBodySha256: sha256(body), elapsedMs: Math.max(0, performance.now() - started) };
  };
  const emit = () => onEvidence?.(snapshot());
  const timeoutError = () => {
    timedOut = true;
    const error = new Error(`Tenant HTTP deadline exceeded during ${receipt.phase}`);
    error.code = 'TENANT_HTTP_TIMEOUT';
    controller.abort(error);
    return error;
  };
  // Immediately fulfilled reads may starve timer callbacks. The monotonic guard
  // enforces the same deadline even when no timers-phase turn is available.
  const checkDeadline = () => {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (performance.now() >= deadlineAt) throw timeoutError();
  };
  emit();
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError()), timeoutMs);
  });
  const operation = async () => {
    checkDeadline();
    response = await fetchImpl(url, { ...init, signal: controller.signal, redirect: 'manual' });
    headerMs = performance.now() - started;
    receipt.actualHttpStatus = response.status;
    receipt.headers = Object.fromEntries(retainedHeaders.map(key => [key, response.headers.get(key)]));
    receipt.phase = 'body'; emit();
    checkDeadline();
    if (response.body) {
      reader = response.body.getReader();
      while (true) {
        checkDeadline();
        const part = await reader.read();
        if (controller.signal.aborted) throw controller.signal.reason;
        if (part.done) { checkDeadline(); break; }
        const chunk = Buffer.from(part.value); chunks.push(chunk); bytes += chunk.length;
        emit(); // Retain partial bytes before any deadline or custody-bound failure.
        checkDeadline();
        if (bytes > maxResponseBytes) {
          const error = new Error('Tenant response exceeds retained test-custody bound');
          error.code = 'TENANT_RESPONSE_CUSTODY_LIMIT'; throw error;
        }
      }
    }
    checkDeadline();
    receipt.completeBody = true;
    const body = Buffer.concat(chunks), text = new TextDecoder().decode(body);
    checkDeadline();
    let json = null; try { json = JSON.parse(text); } catch { /* Same raw response/parser semantics as the original client. */ }
    checkDeadline();
    receipt.phase = 'completion-custody'; emit();
    checkDeadline();
    receipt.status = 'completed'; receipt.phase = 'complete'; emit();
    return { status: response.status, headers: response.headers, bytes: body, text, json, ms: headerMs };
  };
  try {
    return await Promise.race([operation(), deadline]);
  } catch (caught) {
    const error = caught instanceof Error ? caught : Object.assign(new Error(String(caught)), { cause: caught });
    receipt.status = 'failed'; receipt.failureCode = error?.code ?? 'TENANT_TRANSPORT_FAILURE';
    receipt.error = String(error?.stack ?? error); receipt.timedOut = timedOut;
    controller.abort(error);
    if (reader) {
      receipt.cancelRequested = true;
      // Do not wait on a broken stream's cancellation. The owning native runtime is separately bounded and disposed by the outer runner.
      try { Promise.resolve(reader.cancel(error)).catch(() => {}); } catch { /* Failure receipt still remains failed. */ }
    }
    error.transportReceipt = snapshot(); emit(); throw error;
  } finally {
    clearTimeout(timer);
    try { reader?.releaseLock(); } catch { /* An ignored abort may leave a pending read; never wait unboundedly. */ }
  }
}

/** Existing client request shapes and operation keys, with this test's bounded transport. */
export function createBoundedTenantTransport(base, options = {}) {
  const request = (path, init) => boundedTenantRequest(base, path, init, options);
  const call = (who, path, { method = 'GET', body, org, headers = {} } = {}) => {
    const h = { ...(who?.headers ?? {}), ...(org ? { 'x-saha-organisation': org } : {}), ...headers };
    if (body !== undefined) { h['Content-Type'] = 'application/json'; h['Idempotency-Key'] ??= randomUUID(); }
    return request(path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  };
  return { request, call, get: (who, path, org) => call(who, path, { org }),
    command: (who, body, org) => call(who, '/api/commands', { method: 'POST', body, org }) };
}
