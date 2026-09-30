import { useData } from '../hooks/useData';
import { TrustContext } from '../utils/trustContext';
import { PublicationNotice, UnavailableCard } from './ui/DataState';

export default function DatasetTrustScope({ datasetId, children }) {
  const result = useData(datasetId ? `${datasetId}.json` : 'data-freshness.json');
  if (!datasetId) return children;
  if (result.unavailable && !['reserves', 'fiscal'].includes(datasetId)) return <UnavailableCard {...result.unavailable} />;
  return (
    <TrustContext.Provider value={{ datasetId, data: result.data }}>
      <PublicationNotice data={result.data} />
      {children}
    </TrustContext.Provider>
  );
}
