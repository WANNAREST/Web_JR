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
          size_bytes, character_count, sentence_count, quality_score,
          quality_diagnostics, status, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        document.sourceQuality?.score ?? null,
        document.sourceQuality ?? null,
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
        raw_score: Number(term.rawScore ?? term.score),
        frequency: Number(term.frequency ?? 1),
        candidate_group: String(term.group ?? "new_potential_term"),
        extraction_source: String(term.source ?? "unknown")
      };
    });

    let candidateRows = [];
    if (candidateInputs.length) {
      candidateRows = (await client.query(`
        INSERT INTO term_candidates (
          extraction_run_id, term_id, score, raw_score, frequency, candidate_group, extraction_source
        )
        SELECT $1, input.term_id, input.score, input.raw_score, input.frequency, input.candidate_group, input.extraction_source
        FROM jsonb_to_recordset($2::jsonb) AS input(
          term_id uuid,
          score numeric,
          raw_score numeric,
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
          segment_id: occurrence.segmentId ?? null,
          segment_type: occurrence.segmentType ?? null,
          source_bbox: occurrence.bbox ?? null,
          score: Number(occurrence.score ?? term.score),
          raw_score: Number(occurrence.rawScore ?? term.rawScore ?? occurrence.score ?? term.score)
        });
        occurrence.documentId = documentId;
      }
    }

    for (let index = 0; index < occurrenceInputs.length; index += 1000) {
      const chunk = occurrenceInputs.slice(index, index + 1000);
      await client.query(`
        INSERT INTO term_occurrences (
          term_candidate_id, document_id, page_number, sentence_text,
          start_char, end_char, segment_id, segment_type, source_bbox, score,
          raw_score
        )
        SELECT
          input.term_candidate_id, input.document_id, input.page_number,
          input.sentence_text, input.start_char, input.end_char,
          input.segment_id, input.segment_type, input.source_bbox, input.score,
          input.raw_score
        FROM jsonb_to_recordset($1::jsonb) AS input(
          term_candidate_id uuid,
          document_id uuid,
          page_number integer,
          sentence_text text,
          start_char integer,
          end_char integer,
          segment_id text,
          segment_type text,
          source_bbox jsonb,
          score numeric,
          raw_score numeric
        )
      `, [JSON.stringify(chunk)]);
    }

    return {
      runId,
      documentIdsByStorageKey: Object.fromEntries(documentIdByStorageKey),
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
      occurrence.segment_id AS "segmentId",
      occurrence.segment_type AS "segmentType",
      occurrence.source_bbox AS bbox,
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

export async function getDocumentReviewSummary() {
  return (await query(`
    WITH document_terms AS (
      SELECT DISTINCT occurrence.document_id, candidate.term_id
      FROM term_occurrences occurrence
      JOIN term_candidates candidate ON candidate.id = occurrence.term_candidate_id
    )
    SELECT
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE COALESCE(review.review_status, 'unreviewed') = 'unreviewed')::integer AS unreviewed,
      COUNT(*) FILTER (WHERE review.review_status = 'approved')::integer AS approved,
      COUNT(*) FILTER (WHERE review.review_status = 'rejected')::integer AS rejected,
      COUNT(*) FILTER (WHERE review.review_status = 'uncertain')::integer AS uncertain
    FROM document_terms
    LEFT JOIN document_term_reviews review
      ON review.document_id = document_terms.document_id AND review.term_id = document_terms.term_id
  `)).rows[0];
}

export async function listReviewedDocumentTerms({ status, search, limit, offset }) {
  const values = [];
  const where = ["review.review_status <> 'unreviewed'"];
  if (status !== "reviewed") {
    values.push(status);
    where.push(`review.review_status = $${values.length}`);
  }
  if (search) {
    values.push(`%${normalizeTerm(search)}%`);
    where.push(`(term.term_text ILIKE $${values.length} OR term.normalized_text ILIKE $${values.length} OR document.original_name ILIKE $${values.length})`);
  }
  values.push(limit, offset);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const result = await query(`
    SELECT
      review.document_id AS "documentId",
      term.id,
      term.term_text AS "termText",
      document.original_name AS "fileName",
      review.review_status AS "reviewStatus",
      review.review_note AS "reviewNote",
      review.reviewed_by_name AS "reviewedByName",
      review.reviewed_at AS "reviewedAt",
      review.review_version AS "reviewVersion",
      occurrence.frequency,
      occurrence.score,
      occurrence.page,
      count(*) OVER()::integer AS "filteredCount"
    FROM document_term_reviews review
    JOIN terms term ON term.id = review.term_id
    JOIN documents document ON document.id = review.document_id
    JOIN LATERAL (
      SELECT
        occurrence.score::float8 AS score,
        occurrence.page_number AS page,
        COUNT(*) OVER ()::integer AS frequency
      FROM term_occurrences occurrence
      JOIN term_candidates candidate ON candidate.id = occurrence.term_candidate_id
      WHERE occurrence.document_id = review.document_id AND candidate.term_id = review.term_id
      ORDER BY occurrence.score DESC, occurrence.page_number NULLS LAST, occurrence.id
      LIMIT 1
    ) occurrence ON true
    ${whereSql}
    ORDER BY review.reviewed_at DESC, term.term_text ASC
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
  `, values);

  const countResult = await query(`
    SELECT COUNT(*)::integer AS count
    FROM document_term_reviews review
    JOIN terms term ON term.id = review.term_id
    JOIN documents document ON document.id = review.document_id
    ${whereSql}
  `, values.slice(0, -2));
  return { items: result.rows, total: countResult.rows[0].count, limit, offset };
}

export async function getReviewedDocumentTermDetail(documentId, termId) {
  const reviewResult = await query(`
    SELECT
      review.document_id AS "documentId",
      term.id,
      term.term_text AS "termText",
      document.original_name AS "fileName",
      review.review_status AS "reviewStatus",
      review.review_note AS "reviewNote",
      review.reviewed_by_name AS "reviewedByName",
      review.reviewed_at AS "reviewedAt",
      review.review_version AS "reviewVersion"
    FROM document_term_reviews review
    JOIN terms term ON term.id = review.term_id
    JOIN documents document ON document.id = review.document_id
    WHERE review.document_id = $1 AND review.term_id = $2
  `, [documentId, termId]);
  if (!reviewResult.rowCount) return null;

  const occurrences = await query(`
    SELECT
      occurrence.id,
      occurrence.document_id AS "documentId",
      document.original_name AS "fileName",
      occurrence.page_number AS page,
      occurrence.sentence_text AS sentence,
      occurrence.start_char AS "startChar",
      occurrence.end_char AS "endChar",
      occurrence.segment_id AS "segmentId",
      occurrence.segment_type AS "segmentType",
      occurrence.source_bbox AS bbox,
      occurrence.score::float8 AS score,
      candidate.extraction_source AS source,
      run.created_at AS "extractedAt"
    FROM term_occurrences occurrence
    JOIN term_candidates candidate ON candidate.id = occurrence.term_candidate_id
    JOIN documents document ON document.id = occurrence.document_id
    JOIN extraction_runs run ON run.id = candidate.extraction_run_id
    WHERE occurrence.document_id = $1 AND candidate.term_id = $2
    ORDER BY occurrence.score DESC, occurrence.page_number NULLS LAST, occurrence.id
    LIMIT 200
  `, [documentId, termId]);
  return { ...reviewResult.rows[0], occurrences: occurrences.rows };
}

export async function getDocumentReviewHistory(documentId, termId) {
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
    FROM document_term_review_history
    WHERE document_id = $1 AND term_id = $2
    ORDER BY created_at DESC, id DESC
  `, [documentId, termId])).rows;
}

export async function getDocument(id) {
  const result = await query(`
    SELECT id, original_name AS "fileName", storage_key AS "storageKey", mime_type AS "mimeType"
    FROM documents
    WHERE id = $1 AND status = 'processed' AND storage_key IS NOT NULL
  `, [id]);
  return result.rows[0] ?? null;
}

export async function findDuplicateDocuments(sha256s) {
  if (!sha256s.length) return [];
  return (await query(`
    WITH latest AS (
      SELECT DISTINCT ON (sha256)
        id, sha256, original_name AS "fileName", created_at AS "extractedAt"
      FROM documents
      WHERE status = 'processed' AND sha256 = ANY($1::text[])
      ORDER BY sha256, created_at DESC
    )
    SELECT
      latest.*,
      COUNT(DISTINCT term.id)::integer AS "termCount",
      COUNT(DISTINCT term.id) FILTER (WHERE COALESCE(review.review_status, 'unreviewed') = 'unreviewed')::integer AS "unreviewedCount"
    FROM latest
    LEFT JOIN term_occurrences occurrence ON occurrence.document_id = latest.id
    LEFT JOIN term_candidates candidate ON candidate.id = occurrence.term_candidate_id
    LEFT JOIN terms term ON term.id = candidate.term_id
    LEFT JOIN document_term_reviews review ON review.document_id = latest.id AND review.term_id = term.id
    GROUP BY latest.id, latest.sha256, latest."fileName", latest."extractedAt"
  `, [sha256s])).rows;
}

export async function listReviewDocuments() {
  return (await query(`
    SELECT
      document.id,
      document.original_name AS "fileName",
      document.mime_type AS "mimeType",
      document.size_bytes AS "sizeBytes",
      document.created_at AS "extractedAt",
      run.mode,
      run.threshold::float8 AS threshold,
      COUNT(DISTINCT term.id)::integer AS "termCount",
      COUNT(DISTINCT term.id) FILTER (WHERE COALESCE(review.review_status, 'unreviewed') = 'unreviewed')::integer AS "unreviewedCount",
      COUNT(DISTINCT term.id) FILTER (WHERE review.review_status = 'approved')::integer AS "approvedCount",
      COUNT(DISTINCT term.id) FILTER (WHERE review.review_status = 'rejected')::integer AS "rejectedCount",
      COUNT(DISTINCT term.id) FILTER (WHERE review.review_status = 'uncertain')::integer AS "uncertainCount"
    FROM documents document
    JOIN extraction_runs run ON run.id = document.extraction_run_id
    LEFT JOIN term_occurrences occurrence ON occurrence.document_id = document.id
    LEFT JOIN term_candidates candidate ON candidate.id = occurrence.term_candidate_id
    LEFT JOIN terms term ON term.id = candidate.term_id
    LEFT JOIN document_term_reviews review ON review.document_id = document.id AND review.term_id = term.id
    WHERE document.status = 'processed'
    GROUP BY document.id, run.id
    ORDER BY document.created_at DESC
  `)).rows;
}

export async function listDocumentReviewTerms(documentId) {
  return (await query(`
    WITH ranked_occurrences AS (
      SELECT
        term.id,
        term.term_text AS term,
        occurrence.score::float8 AS score,
        COUNT(occurrence.id) OVER (PARTITION BY term.id)::integer AS frequency,
        occurrence.sentence_text AS sentence,
        occurrence.page_number AS page,
        ROW_NUMBER() OVER (
          PARTITION BY term.id
          ORDER BY occurrence.score DESC, occurrence.page_number NULLS LAST, occurrence.id
        ) AS occurrence_rank
      FROM term_occurrences occurrence
      JOIN term_candidates candidate ON candidate.id = occurrence.term_candidate_id
      JOIN terms term ON term.id = candidate.term_id
      WHERE occurrence.document_id = $1
    )
    SELECT
      occurrence.id,
      occurrence.term,
      occurrence.score,
      occurrence.frequency,
      occurrence.sentence,
      occurrence.page,
      COALESCE(review.review_status, 'unreviewed') AS "reviewStatus",
      review.review_note AS "reviewNote",
      review.reviewed_by_name AS "reviewedByName",
      review.reviewed_at AS "reviewedAt",
      COALESCE(review.review_version, 0)::integer AS "reviewVersion"
    FROM ranked_occurrences occurrence
    LEFT JOIN document_term_reviews review ON review.document_id = $1 AND review.term_id = occurrence.id
    WHERE occurrence.occurrence_rank = 1
    ORDER BY COALESCE(review.review_status, 'unreviewed') = 'unreviewed' DESC, occurrence.score DESC, occurrence.term
  `, [documentId])).rows;
}

export async function updateDocumentTermReview({ documentId, termId, status, note, expectedVersion, reviewer }) {
  return withTransaction(async (client) => {
    const exists = await client.query(`
      SELECT 1
      FROM term_occurrences occurrence
      JOIN term_candidates candidate ON candidate.id = occurrence.term_candidate_id
      WHERE occurrence.document_id = $1 AND candidate.term_id = $2
      LIMIT 1
    `, [documentId, termId]);
    if (!exists.rowCount) return { kind: "not_found" };

    const previous = await client.query(`
      SELECT review_status AS "reviewStatus", review_version AS "reviewVersion"
      FROM document_term_reviews
      WHERE document_id = $1 AND term_id = $2
    `, [documentId, termId]);
    const previousStatus = previous.rows[0]?.reviewStatus ?? "unreviewed";
    if (!previous.rowCount && expectedVersion !== 0) return { kind: "conflict", current: null };

    const updated = await client.query(`
      INSERT INTO document_term_reviews (
        document_id, term_id, review_status, review_note,
        reviewed_by_username, reviewed_by_name, reviewed_at, review_version
      ) VALUES (
        $1, $2, $3, $4,
        CASE WHEN $3 = 'unreviewed' THEN NULL ELSE $5 END,
        CASE WHEN $3 = 'unreviewed' THEN NULL ELSE $6 END,
        CASE WHEN $3 = 'unreviewed' THEN NULL ELSE now() END,
        1
      )
      ON CONFLICT (document_id, term_id) DO UPDATE
      SET
        review_status = EXCLUDED.review_status,
        review_note = EXCLUDED.review_note,
        reviewed_by_username = EXCLUDED.reviewed_by_username,
        reviewed_by_name = EXCLUDED.reviewed_by_name,
        reviewed_at = EXCLUDED.reviewed_at,
        review_version = document_term_reviews.review_version + 1,
        updated_at = now()
      WHERE document_term_reviews.review_version = $7
      RETURNING
        term_id AS id,
        review_status AS "reviewStatus",
        review_note AS "reviewNote",
        reviewed_by_name AS "reviewedByName",
        reviewed_at AS "reviewedAt",
        review_version AS "reviewVersion"
    `, [documentId, termId, status, note || null, reviewer.username, reviewer.name, expectedVersion]);

    if (!updated.rowCount) {
      const current = await client.query(`
        SELECT term_id AS id, review_status AS "reviewStatus", review_note AS "reviewNote",
          reviewed_by_name AS "reviewedByName", reviewed_at AS "reviewedAt", review_version AS "reviewVersion"
        FROM document_term_reviews WHERE document_id = $1 AND term_id = $2
      `, [documentId, termId]);
      return { kind: "conflict", current: current.rows[0] };
    }

    await client.query(`
      INSERT INTO document_term_review_history (
        document_id, term_id, previous_status, new_status, note,
        reviewer_username, reviewer_name, review_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [documentId, termId, previousStatus, status, note || null, reviewer.username, reviewer.name, updated.rows[0].reviewVersion]);
    return { kind: "updated", term: updated.rows[0] };
  });
}

export async function getTrainingRows() {
  return (await query(`
    SELECT
      term.id AS "termId",
      term.term_text AS term,
      CASE WHEN review.review_status = 'approved' THEN 'positive' ELSE 'negative' END AS label,
      review.review_status AS "reviewStatus",
      review.review_note AS "reviewNote",
      review.reviewed_by_name AS "reviewedByName",
      review.reviewed_at AS "reviewedAt",
      document.id AS "documentId",
      document.original_name AS "fileName",
      occurrence.page_number AS page,
      occurrence.sentence_text AS context,
      occurrence.score::float8 AS "extractionScore"
    FROM document_term_reviews review
    JOIN terms term ON term.id = review.term_id
    JOIN term_candidates candidate ON candidate.term_id = term.id
    JOIN term_occurrences occurrence ON occurrence.term_candidate_id = candidate.id
    JOIN documents document ON document.id = occurrence.document_id AND document.id = review.document_id
    WHERE review.review_status IN ('approved', 'rejected')
    ORDER BY term.term_text, document.original_name, occurrence.page_number NULLS LAST
  `)).rows;
}

export async function getScoreCalibration() {
  const result = await query(`
    WITH samples AS (
      SELECT
        review.document_id,
        review.term_id,
        CASE WHEN review.review_status = 'approved' THEN 1 ELSE 0 END AS label,
        ROUND(MAX(occurrence.raw_score)::numeric, 2)::float8 AS raw_score
      FROM document_term_reviews review
      JOIN term_candidates candidate ON candidate.term_id = review.term_id
      JOIN term_occurrences occurrence
        ON occurrence.term_candidate_id = candidate.id
        AND occurrence.document_id = review.document_id
      WHERE review.review_status IN ('approved', 'rejected')
      GROUP BY review.document_id, review.term_id, review.review_status
    )
    SELECT
      raw_score AS "rawScore",
      COUNT(*)::integer AS weight,
      SUM(label)::integer AS positives
    FROM samples
    GROUP BY raw_score
    ORDER BY raw_score
  `);
  return { bins: result.rows };
}
