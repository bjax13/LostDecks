import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseClient';

export async function updateTradeStatus({ tradeId, status }) {
  if (!tradeId) throw new Error('tradeId is required');
  if (!status) throw new Error('status is required');

  const call = httpsCallable(functions, 'updateTradeStatus');
  const res = await call({ tradeId, status });
  return res.data;
}
