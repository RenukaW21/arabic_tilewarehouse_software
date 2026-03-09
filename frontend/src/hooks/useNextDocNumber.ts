import axiosInstance from '@/api/axios';

export async function fetchNextDocNumber(docType: string): Promise<string> {
  // If the backend doesn't have a /doc-number endpoint yet, return a mock
  try {
    const res = await axiosInstance.get('/utils/next-doc-number', { params: { docType } });
    return res.data?.data || `DOC-${Date.now()}`;
  } catch (err) {
    return `DOC-${Math.floor(Math.random() * 1000)}`;
  }
}
