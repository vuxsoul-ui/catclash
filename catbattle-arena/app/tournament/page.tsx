import TournamentVotingHub from '../components/TournamentVotingHub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TournamentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const fixture = String(params.fixture || '') === '1';
  const debug = String(params.debug || '') === '1';
  return <TournamentVotingHub initialFixtureMode={fixture || debug} initialDebugMode={debug} />;
}
