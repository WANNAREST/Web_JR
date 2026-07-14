import { query, withTransaction } from "./db.js";
import { normalizeTerm } from "./review-domain.js";

const TERM_SELECT = `
  SELECT
    t.id,
    t.term_text AS "termText",
    t.normalized_text AS "normalizedText",
    t.review_status AS "reviewStatus",
    t.review_note AS "reviewNote",
    t.reviewed_by_username AS "reviewedByUsername",
    t.reviewed_by_name AS "reviewedByName",
    t.reviewed_at AS "reviewedAt",
    t.review_version AS "reviewVersion",
    t.created_at AS "createdAt",
    t.updated_at AS "updatedAt"
  FROM terms t`;

export async function persistExtraction({ run, documents, aggregate }) {
  return withTransaction(async (client) => {
    const runResult = await client.query(`
      INSERT INTO extraction_runs (
        created_by_username, created_by_name, mode, threshold, status,
        document_count, sentence_count, character_count, candidate_count,
        elapsed_ms, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      RETURNING id
    `, [
      run.username,
      run.name,
      aggregate.mode,
      aggregate.threshold,
      documents.some((document) => document.error) ? "completed_with_errors" : "completed",
      documents.length,
      aggregate.sentenceCount,
      aggregate.characterCount,
      aggregate.termCount,
      run.elapsedMs
    ]);
    const runId = runResult.rows[0].id;
    const documentIdByStorageKey = new Map();

    for (const document of documents) {
      const result = await client.query(`
        INSERT INTO documents (
          extraction_run_id, original_name, storage_key, sha256, mime_type,
          size_bytes, character_count, sentence_count, status, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        runId,
        document.fileName,
        document.storageKey ?? null,
        document.sha256 ?? null,
        document.mimeType ?? null,
        document.sizeBytes ?? 0,
        document.characterCount ?? 0,
        document.sentenceCount ?? 0,
        document.error ? "failed" : "processed",
        document.error ?? null
      ]);
      if (document.storageKey) documentIdByStorageKey.set(document.storageKey, result.rows[0].id);
    }

    const termInputs = aggregate.terms.map((term) => ({
      termText: term.term,
      normalizedText: normalizeTerm(term.term)
    }));

    if (termInputs.length) {
      await client.query(`
        INSERT INTO terms (term_text, normalized_text)
        SELECT input.term_text, input.normalized_text
        FROM jsonb_to_recordset($1::jsonb) AS input(term_text text, normalized_text text)
        ON CONFLICT (normalized_text) DO NOTHING
      `, [JSON.stringify(termInputs.map((term) => ({
        term_text: term.termText,
        normalized_text: term.normalizedText
      })))]);
    }

    const normalizedTexts = termInputs.map((term) => term.normalizedText);
    const termRows = normalizedTexts.length
      ? (await client.query(`
          ${TERM_SELECT}
          WHERE t.normalized_text = ANY($1::text[])
        `, [normalizedTexts])).rows
      : [];
    const termByNormalized = new Map(termRows.map((term) => [term.normalizedText, term]));

    const candidateInputs = aggregate.terms.map((term) => {
      const persistedTerm = termByNormalized.get(normalizeTerm(term.term));
      return {
        term_id: persistedTerm.id,
        score: Number(term.score),
        frequency: Number(term.frequency ?? 1),
        candidate_group: String(term.group ?? "new_potential_term"),
        extraction_source: String(term.source ?? "unknown")
      };
    });

    let candidateRows = [];
    if (candidateInputs.length) {
      candidateRows = (await client.query(`
        INSERT INTO term_candidates (
          extraction_run_id, term_id, score, frequency, candidate_group, extraction_source
        )
        SELECT $1, input.term_id, input.score, input.frequency, input.candidate_group, input.extraction_source
        FROM jsonb_to_recordset($2::jsonb) AS input(
          term_id uuid,
          score numeric,
          frequency integer,
          candidate_group text,
          extraction_source text
        )
        RETURNING id, term_id AS "termId"
      `, [runId, JSON.stringify(candidateInputs)])).rows;
    }
    const candidateIdByTermId = new Map(candidateRows.map((candidate) => [candidate.termId, candidate.id]));

    const occurrenceInputs = [];
    for (const term of aggregate.terms) {
      const persistedTerm = termByNormalized.get(normalizeTerm(term.term));
      const candidateId = candidateIdByTermId.get(persistedTerm.id);
      for (const occurrence of term.occurrences ?? []) {
        const documentId = documentIdByStorageKey.get(occurrence.storageKey);
        if (!documentId || !occurrence.sentence) continue;
        occurrenceInputs.push({
          term_candidate_id: candidateId,
          document_id: documentId,
          page_number: occurrence.page ?? null,
          sentence_text: occurrence.sentence,
          start_char: occurrence.startChar ?? null,
          end_char: occurrence.endChar ?? null,
          score: Number(occurrence.score ?? term.score)
        });
        occurrence.documentId = documentId;
      }
    }

    for (let index = 0; index < occurrenceInputs.length; index += 1000) {
      const chunk = occurrenceInputs.slice(index, index + 1000);
      await client.query(`
        INSERT INTO term_occurrences (
          term_candidate_id, document_id, page_number, sentence_text,
          start_char, end_char, score
        )
        SELECT
          input.term_candidate_id, input.document_id, input.page_number,
          input.sentence_text, input.start_char, input.end_char, input.score
        FROM jsonb_to_recordset($1::jsonb) AS input(
          term_candidate_id uuid,
          document_id uuid,
          page_number integer,
          sentence_text text,
          start_char integer,
          end_char integer,
          score numeric
        )
      `, [JSON.stringify(chunk)]);
    }

    return {
      runId,
      terms: aggregate.terms.map((term) => {
        const persisted = termByNormalized.get(normalizeTerm(term.term));
        return {
          ...term,
          id: persisted.id,
          reviewStatus: persisted.reviewStatus,
          reviewNote: persisted.reviewNote,
          reviewedByName: persisted.reviewedByName,
          reviewedAt: persisted.reviewedAt,
          reviewVersion: persisted.reviewVersion,
          occurrences: (term.occurrences ?? []).slice(0, 20).map(({ storageKey, ...occurrence }) => occurrence)
        };
      })
    };
  });
}

export async function listTerms({ status, search, limit, offset }) {
  const values = [];
  const where = [];
  if (status === "reviewed") {
    where.push("t.review_status <> 'unreviewed'");
  } else if (status) {
    values.push(status);
    where.push(`t.review_status = $${values.length}`);
  }
  if (search) {
    values.push(`%${normalizeTerm(search)}%`);
    where.push(`(t.term_text ILIKE $${values.length} OR t.normalized_text ILIKE $${values.length})`);
  }
  values.push(limit, offset);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await query(`
    WITH filtered AS (
      SELECT t.*
      FROM terms t
      ${whereSql}
      ORDER BY COALESCE(t.reviewed_at, t.created_at) DESC, t.term_text ASC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    )
    SELECT
      filtered.id,
      filtered.term_text AS "termText",
      filtered.review_status AS "reviewStatus",
      filtered.review_note AS "reviewNote",
      filtered.reviewed_by_name AS "reviewedByName",
      filtered.reviewed_at AS "reviewedAt",
      filtered.review_version AS "reviewVersion",
      filtered.created_at AS "createdAt",
      filtered.updated_at AS "updatedAt",
      COALESCE(stats.frequency, 0)::integer AS frequency,
      stats.score::float8 AS score,
      COALESCE(stats.document_count, 0)::integer AS "documentCount",
      count(*) OVER()::integer AS "filteredCount"
    FROM filtered
    LEFT JOIN LATERAL (
      SELECT
        (SELECT SUM(tc.frequency) FROM term_candidates tc WHERE tc.term_id = filtered.id) AS frequency,
        (SELECT MAX(tc.score) FROM term_candidates tc WHERE tc.term_id = filtered.id) AS score,
        (
          SELECT COUNT(DISTINCT occurrence.document_id)
          FROM term_candidates tc
          JOIN term_occurrences occurrence ON occurrence.term_candidate_id = tc.id
          WHERE tc.term_id = filtered.id
        ) AS document_count
    ) stats ON true
    ORDER BY COALESCE(filtered.reviewed_at, filtered.created_at) DESC, filtered.term_text ASC
  `, values);

  const countResult = await query(`SELECT COUNT(*)::integer AS count FROM terms t ${whereSql}`, values.slice(0, -2));
  return { items: result.rows, total: countResult.rows[0].count, limit, offset };
}

export async function getTermDetail(id) {
  const termResult = await query(`${TERM_SELECT} WHERE t.id = $1`, [id]);
  if (!termResult.rowCount) return null;
  const occurrences = await query(`
    SELECT
      occurrence.id,
      occurrence.document_id AS "documentId",
      document.original_name AS "fileName",
      occurrence.page_number AS page,
      occurrence.sentence_text AS sentence,
      occurrence.start_char AS "startChar",
      occurrence.end_char AS "endChar",
      occurrence.score::float8 AS score,
      candidate.extraction_source AS source,
      run.created_at AS "extractedAt"
    FROM term_occurrences occurrence
    JOIN term_candidates candidate ON candidate.id = occurrence.term_candidate_id
    JOIN documents document ON document.id = occurrence.document_id
    JOIN extraction_runs run ON run.id = candidate.extraction_run_id
    WHERE candidate.term_id = $1
    ORDER BY run.created_at DESC, document.original_name, occurrence.page_number NULLS LAST
    LIMIT 200
  `, [id]);
  return { ...termResult.rows[0], occurrences: occurrences.rows };
}

export async function getReviewHistory(id) {
  return (await query(`
    SELECT
      id,
      previous_status AS "previousStatus",
      new_status AS "newStatus",
      note,
      reviewer_username AS "reviewerUsername",
      reviewer_name AS "reviewerName",
      review_version AS "reviewVersion",
      created_at AS "createdAt"
    FROM term_review_history
    WHERE term_id = $1
    ORDER BY created_at DESC, id DESC
  `, [id])).rows;
}

export async function updateTermReview({ id, status, note, expectedVersion, reviewer }) {
  return withTransaction(async (client) => {
    const previous = await client.query(`
      SELECT review_status AS "reviewStatus", review_version AS "reviewVersion"
      FROM terms WHERE id = $1
    `, [id]);
    if (!previous.rowCount) return { kind: "not_found" };

    const updated = await client.query(`
      UPDATE terms
      SET
        review_status = $2,
        review_note = $3,
        reviewed_by_username = CASE WHEN $2 = 'unreviewed' THEN NULL ELSE $4 END,
        reviewed_by_name = CASE WHEN $2 = 'unreviewed' THEN NULL ELSE $5 END,
        reviewed_at = CASE WHEN $2 = 'unreviewed' THEN NULL ELSE now() END,
        review_version = review_version + 1
      WHERE id = $1 AND review_version = $6
      RETURNING
        id,
        term_text AS "termText",
        review_status AS "reviewStatus",
        review_note AS "reviewNote",
        reviewed_by_name AS "reviewedByName",
        reviewed_at AS "reviewedAt",
        review_version AS "reviewVersion",
        updated_at AS "updatedAt"
    `, [id, status, note || null, reviewer.username, reviewer.name, expectedVersion]);

    if (!updated.rowCount) {
      const current = await client.query(`${TERM_SELECT} WHERE t.id = $1`, [id]);
      return { kind: "conflict", current: current.rows[0] };
    }

    await client.query(`
      INSERT INTO term_review_history (
        term_id, previous_status, new_status, note,
        reviewer_username, reviewer_name, review_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      id,
      previous.rows[0].reviewStatus,
      status,
      note || null,
      reviewer.username,
      reviewer.name,
      updated.rows[0].reviewVersion
    ]);
    return { kind: "updated", term: updated.rows[0] };
  });
}

export async function getReviewSummary() {
  return (await query(`
    SELECT
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE review_status = 'unreviewed')::integer AS unreviewed,
      COUNT(*) FILTER (WHERE review_status = 'approved')::integer AS approved,
      COUNT(*) FILTER (WHERE review_status = 'rejected')::integer AS rejected,
      COUNT(*) FILTER (WHERE review_status = 'uncertain')::integer AS uncertain
    FROM terms
  `)).rows[0];
}

export async function getDocument(id) {
  const result = await query(`
    SELECT id, original_name AS "fileName", storage_key AS "storageKey", mime_type AS "mimeType"
    FROM documents
    WHERE id = $1 AND status = 'processed' AND storage_key IS NOT NULL
  `, [id]);
  return result.rows[0] ?? null;
}

export async function getTrainingRows() {
  return (await query(`
    SELECT
      term.id AS "termId",
      term.term_text AS term,
      CASE WHEN term.review_status = 'approved' THEN 'positive' ELSE 'negative' END AS label,
      term.review_status AS "reviewStatus",
      term.review_note AS "reviewNote",
      term.reviewed_by_name AS "reviewedByName",
      term.reviewed_at AS "reviewedAt",
      document.id AS "documentId",
      document.original_name AS "fileName",
      occurrence.page_number AS page,
      occurrence.sentence_text AS context,
      occurrence.score::float8 AS "extractionScore"
    FROM terms term
    JOIN term_candidates candidate ON candidate.term_id = term.id
    JOIN term_occurrences occurrence ON occurrence.term_candidate_id = candidate.id
    JOIN documents document ON document.id = occurrence.document_id
    WHERE term.review_status IN ('approved', 'rejected')
    ORDER BY term.term_text, document.original_name, occurrence.page_number NULLS LAST
  `)).rows;
}
