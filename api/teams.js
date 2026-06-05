import { sql } from './_db.js';

export default async function handler(req, res) {
//   res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
res.setHeader('Cache-Control', 'no-store');
  try {
    const { team, scope = 'TOTAL' } = req.query;
    const rows = team
      ? await sql`SELECT * FROM team_accumulated_stats WHERE team = ${team} AND scope = ${scope}`
      : await sql`SELECT * FROM team_accumulated_stats WHERE scope = ${scope} ORDER BY points DESC NULLS LAST`;
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
}