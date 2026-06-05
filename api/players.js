import { sql } from './_db.js';

export default async function handler(req, res) {
  // CORS + caching: cache responses at the edge for 1 hour (stats rarely change).
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const {
      nationality,           // ?nationality=Brazil
      scope = 'TOTAL',       // ?scope=WC%20Qualifiers
      sort = 'goals_per_90', // ?sort=xg_per_90
      order = 'desc',        // ?order=asc
      min_minutes = '0',     // ?min_minutes=270  (floor for per-90 leaderboards)
      limit = '50',
    } = req.query;

    // Whitelist sortable columns — NEVER interpolate user input into SQL directly.
    const SORTABLE = new Set([
      'goals_per_90', 'assists_per_90', 'xg_per_90', 'xa_per_90',
      'shots_per_90', 'tackles_per_90', 'goals_involved_per_90',
      'minutes_played_overall', 'goals_overall', 'assists_overall',
    ]);
    const sortCol = SORTABLE.has(sort) ? sort : 'goals_per_90';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const lim = Math.min(parseInt(limit, 10) || 50, 500);
    const minMin = parseInt(min_minutes, 10) || 0;

    // Parameterised query ($1, $2…) prevents SQL injection.
    // Build the WHERE clause conditionally on whether nationality was passed.
    let rows;
    if (nationality) {
      rows = await sql`
        SELECT player_id, full_name, nationality, position, current_club,
               minutes_played_overall, goals_overall, assists_overall,
               goals_per_90, assists_per_90, xg_per_90, goals_involved_per_90
        FROM player_accumulated_stats
        WHERE scope = ${scope}
          AND nationality = ${nationality}
          AND minutes_played_overall >= ${minMin}
        ORDER BY ${sql.unsafe(`"${sortCol}" ${sortDir} NULLS LAST`)}
        LIMIT ${lim}
      `;
    } else {
      rows = await sql`
        SELECT player_id, full_name, nationality, position, current_club,
               minutes_played_overall, goals_overall, assists_overall,
               goals_per_90, assists_per_90, xg_per_90, goals_involved_per_90
        FROM player_accumulated_stats
        WHERE scope = ${scope}
          AND minutes_played_overall >= ${minMin}
        ORDER BY ${sql.unsafe(`"${sortCol}" ${sortDir} NULLS LAST`)}
        LIMIT ${lim}
      `;
    }

    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
}