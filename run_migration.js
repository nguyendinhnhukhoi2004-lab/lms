const fs = require('fs');
const {Pool} = require('pg');
const pool = new Pool({user:'postgres', password:'khoi05112004', database:'exam_system'});
let sql = fs.readFileSync('database/migrate_difficulty_3levels.sql', 'utf8');

// Insert DROP VIEW before the TYPE ALTERING
sql = sql.replace('ALTER TABLE public.questions', 'DROP VIEW IF EXISTS public.exam_matrix_summary;\n\nALTER TABLE public.questions');

// Insert CREATE VIEW at the end of the script, before COMMIT if there's any
const viewDef = `
CREATE VIEW public.exam_matrix_summary AS
SELECT
    em.exam_id,
    e.title AS exam_title,
    SUM(em.question_count) AS total_questions,
    SUM(em.question_count::numeric * em.score_per_question) AS total_score,
    CASE
        WHEN ABS(SUM(em.question_count::numeric * em.score_per_question) - 10) < 0.01
        THEN true ELSE false
    END AS is_score_valid,
    json_agg(json_build_object(
        'type', em.type,
        'difficulty', em.difficulty,
        'question_count', em.question_count,
        'score_per_question', em.score_per_question,
        'subtotal', em.question_count::numeric * em.score_per_question,
        'topic_filter', em.topic_filter
    ) ORDER BY em.type, em.difficulty) AS matrix_rows
FROM public.exam_matrix em
JOIN public.exams e ON em.exam_id = e.id
GROUP BY em.exam_id, e.title;
`;

sql = sql.replace('COMMIT;', viewDef + '\nCOMMIT;');

pool.query(sql)
  .then(res => { console.log('Migration ran successfully'); process.exit(0); })
  .catch(err => { console.error('Migration failed:', err); process.exit(1); });
