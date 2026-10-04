import { canon, sha256Hex } from "./canon";

export type Check = { label: string; pass: boolean };
export type Stage = { title: string; checks: Check[] };

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const REQ_ID_RE = /^REQ-[0-9]{3}$/;

const TERMINAL = new Set(["SETTLED", "REFUNDED", "FINALIZED", "CANCELLED"]);
const VERDICTS = new Set(["PASS", "FAIL", "INSUFFICIENT_EVIDENCE", "CONFLICTING_EVIDENCE", "NOT_VERIFIED"]);

type AnyRecord = Record<string, never> | Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function verifyCertificate(certInput: unknown, bundleInput?: unknown): Promise<Stage[]> {
  const stages: Stage[] = [];
  const cert: AnyRecord = isRecord(certInput) ? certInput : {};
  const has = (key: string) => key in cert;

  // ---- structure
  const structure: Check[] = [];
  const required = [
    "protocol", "statement", "agreement_id", "buyer", "worker", "currency",
    "amount", "deadline", "created_at", "agreement_hash", "frozen_hash",
    "specification", "specification_hash", "requirements_hash", "policies",
    "policies_hash", "evidence", "requirements", "challenges", "final_verdict",
    "terminal_state", "settlement", "certificate_hash",
  ];
  structure.push({ label: "certificate is a JSON object", pass: isRecord(certInput) });
  structure.push({ label: "all top-level fields present", pass: required.every(has) });
  if (isRecord(certInput) && required.every(has)) {
    structure.push({ label: "protocol identity is Pactmark", pass: cert.protocol === "Pactmark" });
    structure.push({
      label: "buyer and worker are distinct valid addresses",
      pass:
        ADDRESS_RE.test(String(cert.buyer)) &&
        ADDRESS_RE.test(String(cert.worker)) &&
        String(cert.buyer).toLowerCase() !== String(cert.worker).toLowerCase(),
    });
    structure.push({
      label: "terminal state and verdict are recognised",
      pass: TERMINAL.has(String(cert.terminal_state)) && VERDICTS.has(String(cert.final_verdict)),
    });
  }
  stages.push({ title: "Structure", checks: structure });
  if (!structure.every((c) => c.pass)) return stages;

  // ---- internal consistency
  const consistency: Check[] = [];
  const amount = BigInt(String(cert.amount ?? "0"));
  const settlement = isRecord(cert.settlement) ? cert.settlement : {};
  const toWorker = BigInt(String(settlement.to_worker ?? "0"));
  const toBuyer = BigInt(String(settlement.to_buyer ?? "0"));
  consistency.push({ label: "escrowed amount is positive", pass: amount > 0n });
  consistency.push({
    label: "settlement splits exactly the escrowed amount",
    pass: amount === toWorker + toBuyer,
  });
  consistency.push({
    label: "a settled agreement pays the worker in full",
    pass: cert.terminal_state !== "SETTLED" || toBuyer === 0n,
  });
  consistency.push({
    label: "a refunded agreement repays the buyer in full",
    pass: cert.terminal_state !== "REFUNDED" || toWorker === 0n,
  });
  consistency.push({
    label: "deadline, creation and finalization order correctly",
    pass: Number(cert.deadline) > Number(cert.created_at) && Number(cert.finalized_at) >= Number(cert.created_at),
  });
  const hashFields = ["agreement_hash", "frozen_hash", "specification_hash", "requirements_hash", "policies_hash", "certificate_hash"];
  consistency.push({
    label: "all digest fields are sha256 hex",
    pass:
      hashFields.every((f) => HASH_RE.test(String(cert[f] ?? ""))) &&
      HASH_RE.test(String((cert.evidence as Record<string, unknown>)?.root ?? "")),
  });
  const requirements = Array.isArray(cert.requirements) ? cert.requirements : [];
  consistency.push({
    label: "requirement ids are unique REQ-nnn entries",
    pass:
      requirements.length > 0 &&
      requirements.every((r) => REQ_ID_RE.test(String(r?.requirement_id ?? ""))) &&
      new Set(requirements.map((r) => r.requirement_id)).size === requirements.length,
  });
  consistency.push({
    label: "every requirement carries a concrete verdict and bounded quotes",
    pass: requirements.every((r) => {
      const quotes = (r?.verification?.quotes ?? []) as { quote?: string }[];
      return (
        ["PASS", "FAIL", "INSUFFICIENT_EVIDENCE"].includes(String(r?.status)) &&
        quotes.every((q) => String(q.quote ?? "").length >= 6 && String(q.quote ?? "").length <= 400)
      );
    }),
  });
  stages.push({ title: "Internal consistency", checks: consistency });

  // ---- evidence bundle
  if (bundleInput !== undefined) {
    const bundleCheck: Check[] = [];
    const bundle: AnyRecord = isRecord(bundleInput) ? bundleInput : {};
    const items = Array.isArray(bundle.items) ? bundle.items : [];
    const byId = new Map(items.map((it) => [String(it.item_id), it]));
    bundleCheck.push({
      label: "bundle belongs to this agreement",
      pass: bundle.agreement_id === cert.agreement_id,
    });
    const certItems = ((cert.evidence as Record<string, unknown>)?.items ?? []) as { item_id: string }[];
    bundleCheck.push({
      label: "certificate and bundle list the same evidence items",
      pass:
        certItems.length === items.length &&
        certItems.every((ci) => byId.has(String(ci.item_id))),
    });
    for (const item of items) {
      const content = String(item.content ?? "");
      bundleCheck.push({
        label: `${item.item_id}: content hash matches sha256 of the bytes`,
        pass: (await sha256Hex(content)) === item.content_hash,
      });
      bundleCheck.push({
        label: `${item.item_id}: recorded length matches the bytes`,
        pass: new TextEncoder().encode(content).length === Number(item.length),
      });
    }
    for (const req of requirements) {
      const quotes = (req?.verification?.quotes ?? []) as { evidence_id?: string; quote?: string }[];
      for (const quote of quotes) {
        const source = byId.get(String(quote.evidence_id));
        bundleCheck.push({
          label: `${req.requirement_id}: quote grounded in ${quote.evidence_id}`,
          pass: Boolean(source) && String(source.content).includes(String(quote.quote).trim()),
        });
      }
    }
    if (items.length > 0) {
      const rows = items.map((it) => ({
        item_id: it.item_id,
        kind: it.kind,
        source: it.source,
        content_hash: it.content_hash,
        length: it.length,
        mutable: it.mutable,
      }));
      const root = await sha256Hex(canon({ agreement_id: cert.agreement_id, items: rows }));
      bundleCheck.push({
        label: "evidence root recomputes from the bundle",
        pass: root === (cert.evidence as Record<string, unknown>)?.root,
      });
    }
    stages.push({ title: "Evidence bundle", checks: bundleCheck });
  }

  // ---- canonical hash
  const hashChecks: Check[] = [];
  const stated = String(cert.certificate_hash ?? "");
  const body = Object.fromEntries(Object.entries(cert).filter(([k]) => k !== "certificate_hash"));
  const recomputed = await sha256Hex(canon(body));
  hashChecks.push({ label: "stated certificate hash is well formed", pass: HASH_RE.test(stated) });
  hashChecks.push({ label: "certificate hash recomputes from the body", pass: recomputed === stated });
  stages.push({ title: "Canonical hash", checks: hashChecks });

  return stages;
}
