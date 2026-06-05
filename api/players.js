import { sql } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const {
      nationality,
      scope = 'TOTAL',
      sort = 'goals_per_90',
      order = 'desc',
      min_minutes = '0',
      limit = '50',
    } = req.query;

    // Whitelist sortable columns — the ONLY values allowed into the query string.
    const SORTABLE = new Set([
      'goals_per_90', 'assists_per_90', 'xg_per_90', 'xa_per_90',
      'shots_per_90', 'tackles_per_90', 'goals_involved_per_90',
      'minutes_played_overall', 'goals_overall', 'assists_overall',
    ]);
    const sortCol = SORTABLE.has(sort) ? sort : 'goals_per_90';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const lim = Math.min(parseInt(limit, 10) || 50, 500);
    const minMin = parseInt(min_minutes, 10) || 0;

    // Build a parameterised query string. User values go in as $1, $2… params.
    // sortCol/sortDir are safe to inline because they come from whitelists, not req.query.
    const params = [scope, minMin];
    let where = `scope = $1 AND minutes_played_overall >= $2`;
    if (nationality) {
      params.push(nationality);
      where += ` AND nationality = $${params.length}`;
    }
    params.push(lim);

    const queryText = `
      SELECT player_id, full_name, nationality, position, current_club,
             minutes_played_overall, goals_overall, assists_overall,
             goals_per_90, assists_per_90, xg_per_90, goals_involved_per_90
      FROM player_accumulated_stats
      WHERE ${where}
      ORDER BY "${sortCol}" ${sortDir} NULLS LAST
      LIMIT $${params.length}
    `;

    const rows = await sql.query(queryText, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
}