// Re-export the shared axios instance so all imports from this module
// get the same base URL, auth header, and error-interceptor as @/api/axios.
export { default } from '@/api/axios';
