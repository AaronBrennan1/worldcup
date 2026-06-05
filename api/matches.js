import { sql } from './_db.js';

/**
 * /api/matches — recent fixtures from a single team's point of view.
 *
 * Backed by Dataset 1 (`team_match_history`): one row per team per match,
 * already framed as team_* (this team) vs opp_* (opponent), so the frontend
 * match cards / form chart / form strips can read it directly.
 *
 * Query params:
 *   team   (required for the country page)  exact team name, e.g. "Argentina"
 *   scope  default "TOTAL"                  see mapping below
 *   limit  default 10, max 100
 *
 * Scope note: `team_match_history` has NO `scope` column (scope lives on the
 * accumulated datasets). For fixtures, "TOTAL" means *all competitions* (no
 * filter); any other scope maps onto the `comp_type` breakdown dimension.
 */

// Frontend scope label -> matches `comp_type` value. TOTAL = no filter.
const SCOPE_TO_COMP_TYPE = {
  'TOTAL': null,
  'WC Qualifiers': 'WC Qualifiers',
  'Nations League': 'Nations League',
  'Continental Cup': 'Continental Cup',
  'International Friendlies': 'International Friendlies',
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    // res.setHeader('Cache-Control', 'no-store');

  try {
    const { team, scope = 'TOTAL', limit = '10' } = req.query;

    if (!team) {
      // No team => return an empty array rather than erroring, so the
      // frontend's "recent results" section can render an empty state.
      res.status(200).json([]);
      return;
    }

    const lim = Math.min(parseInt(limit, 10) || 10, 100);
    // Map scope -> comp_type (null = all competitions). Unknown scope = TOTAL.
    const compType = Object.prototype.hasOwnProperty.call(SCOPE_TO_COMP_TYPE, scope)
      ? SCOPE_TO_COMP_TYPE[scope]
      : null;

    // Only completed fixtures, most recent first. Build params positionally so
    // the comp_type filter is optional. (No user value is ever inlined.)
    const params = [team];
    let where = `team = $1 AND status = 'complete'`;
    if (compType) {
      params.push(compType);
      where += ` AND comp_type = $${params.length}`;
    }
    params.push(lim);

    const queryText = `
      SELECT
        match_id, date, competition, comp_type, venue,
        team, opponent, result, points,
        goals_for, goals_against, goal_diff, clean_sheet,
        team_xg, opp_xg,
        team_shots, opp_shots,
        team_shots_on_target, opp_shots_on_target,
        team_possession, opp_possession,
        team_corners, opp_corners,
        team_yellow_cards, opp_yellow_cards
      FROM team_match_history
      WHERE ${where}
      ORDER BY date DESC NULLS LAST
      LIMIT $${params.length}
    `;

    const rows = await sql.query(queryText, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
}