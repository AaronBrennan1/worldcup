import { sql } from './_db.js';

export default async function handler(req, res) {
//   res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Cache-Control', 'no-store');

  try {
    const {
      nationality,
      position,
      scope = 'TOTAL',
      sort = 'goals_per_90',
      order = 'desc',
      min_minutes = '0',
      limit = '50',
    } = req.query;

    // ------------------------------------------------------------------
    // Whitelist of all sortable columns (safe to inline into query text).
    // Covers every per-90, counting, and derived rate in player_accumulated_stats.
    // ------------------------------------------------------------------
    const SORTABLE = new Set([
      // identity / volume
      'minutes_played_overall', 'appearances_overall', 'games_started',
      'games_subbed_in', 'games_subbed_out',

      // attacking
      'goals_overall', 'assists_overall', 'goals_involved',
      'goals_per_90', 'assists_per_90', 'goals_involved_per_90',
      'xg_per_90', 'xa_per_90', 'npxg_per_90',
      'xg_total_overall', 'xa_total_overall', 'npxg_total_overall',
      'xg_overperformance',
      'shots_total_overall', 'shots_on_target_total_overall', 'shots_off_target_total_overall',
      'shots_per_90', 'shots_on_target_per_90',
      'shot_conversion_rate', 'shot_accuracy',
      'hit_woodwork_total_overall',
      'penalty_goals', 'penalty_misses',
      'pen_scored_total_overall', 'pen_missed_total_overall', 'penalties_won_total_overall',
      'offsides_total_overall',

      // chance creation / passing
      'key_passes_total_overall', 'key_passes_per_90',
      'chances_created_total_overall', 'chances_created_per_90',
      'passes_total_overall', 'passes_completed_total_overall',
      'pass_completion_rate',
      'through_passes_total_overall', 'long_passes_total_overall', 'short_passes_total_overall',
      'crosses_total_overall', 'accurate_crosses_total_overall',

      // dribbling / carrying
      'dribbles_total_overall', 'dribbles_successful_total_overall',
      'dribbles_per_90',
      'dispossesed_total_overall',
      'fouls_drawn_total_overall',

      // defending
      'tackles_total_overall', 'tackles_successful_total_overall',
      'tackles_per_90', 'tackles_won_per_90', 'tackle_success_rate',
      'interceptions_total_overall', 'interceptions_per_90',
      'clearances_total_overall', 'clearances_per_90',
      'blocks_total_overall',
      'aerial_duels_total_overall', 'aerial_duels_won_total_overall',
      'duels_total_overall', 'duels_won_total_overall',
      'duels_won_per_90',
      'pressures_total_overall', 'pressures_per_90',
      'possession_regained_total_overall',
      'fouls_committed_total_overall',
      'dribbled_past_total_overall',

      // goalkeeping
      'saves_total_overall', 'saves_per_90',
      'shots_faced_total_overall',
      'clean_sheets_overall',
      'conceded_overall', 'conceded_per_90',
      'punches_total_overall',

      // discipline / misc
      'yellow_cards_overall', 'red_cards_overall',
      'man_of_the_match_total_overall',
    ]);

    const sortCol = SORTABLE.has(sort) ? sort : 'goals_per_90';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const lim = Math.min(parseInt(limit, 10) || 50, 500);
    const minMin = parseInt(min_minutes, 10) || 0;

    // ------------------------------------------------------------------
    // Build parameterised WHERE clause
    // ------------------------------------------------------------------
    const params = [scope, minMin];
    let where = `scope = $1 AND minutes_played_overall >= $2`;

    if (nationality) {
      params.push(nationality);
      where += ` AND nationality = $${params.length}`;
    }
    if (position) {
      params.push(position);
      where += ` AND position = $${params.length}`;
    }

    params.push(lim);

    // ------------------------------------------------------------------
    // SELECT — all columns from player_accumulated_stats
    // sortCol/sortDir come from whitelists; all user values use $n params.
    // ------------------------------------------------------------------
    const queryText = `
      SELECT
        -- identity
        player_id,
        full_name,
        nationality,
        position,
        current_club,

        -- volume
        minutes_played_overall,
        appearances_overall,
        games_started,
        games_subbed_in,
        games_subbed_out,

        -- attacking totals
        goals_overall,
        assists_overall,
        goals_involved,
        xg_total_overall,
        xa_total_overall,
        npxg_total_overall,
        xg_overperformance,
        shots_total_overall,
        shots_on_target_total_overall,
        shots_off_target_total_overall,
        hit_woodwork_total_overall,
        penalty_goals,
        penalty_misses,
        pen_scored_total_overall,
        pen_missed_total_overall,
        penalties_won_total_overall,
        offsides_total_overall,

        -- attacking per-90
        goals_per_90,
        assists_per_90,
        goals_involved_per_90,
        xg_per_90,
        xa_per_90,
        npxg_per_90,
        shots_per_90,
        shots_on_target_per_90,

        -- attacking rates
        shot_conversion_rate,
        shot_accuracy,

        -- chance creation / passing totals
        key_passes_total_overall,
        chances_created_total_overall,
        passes_total_overall,
        passes_completed_total_overall,
        through_passes_total_overall,
        long_passes_total_overall,
        short_passes_total_overall,
        crosses_total_overall,
        accurate_crosses_total_overall,

        -- chance creation / passing per-90 & rates
        key_passes_per_90,
        chances_created_per_90,
        pass_completion_rate,

        -- dribbling totals
        dribbles_total_overall,
        dribbles_successful_total_overall,
        dispossesed_total_overall,
        fouls_drawn_total_overall,

        -- dribbling per-90
        dribbles_per_90,

        -- defending totals
        tackles_total_overall,
        tackles_successful_total_overall,
        interceptions_total_overall,
        clearances_total_overall,
        blocks_total_overall,
        aerial_duels_total_overall,
        aerial_duels_won_total_overall,
        duels_total_overall,
        duels_won_total_overall,
        pressures_total_overall,
        possession_regained_total_overall,
        fouls_committed_total_overall,
        dribbled_past_total_overall,

        -- defending per-90 & rates
        tackles_per_90,
        tackles_won_per_90,
        tackle_success_rate,
        interceptions_per_90,
        clearances_per_90,
        duels_won_per_90,
        pressures_per_90,

        -- goalkeeping totals
        saves_total_overall,
        shots_faced_total_overall,
        clean_sheets_overall,
        conceded_overall,
        punches_total_overall,

        -- goalkeeping per-90
        saves_per_90,
        conceded_per_90,

        -- discipline / misc
        yellow_cards_overall,
        red_cards_overall,
        man_of_the_match_total_overall

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