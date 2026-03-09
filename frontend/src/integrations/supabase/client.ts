// We dummy out the supabase client entirely since we are using local backend now
// This prevents errors across 20+ pages until we refactor them one by one

export const supabase = {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    getSession: async () => ({ data: { session: null } }),
    signOut: async () => { },
  },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        order: () => ({
          limit: async () => ({ data: [], error: null })
        })
      }),
      order: () => ({
        limit: async () => ({ data: [], error: null })
      }),
      then: async () => ({ data: [], error: null })
    }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: null })
      })
    }),
    update: () => ({
      eq: () => ({
        select: () => ({
          single: async () => ({ data: null, error: null })
        })
      })
    }),
    delete: () => ({
      eq: async () => ({ data: null, error: null })
    })
  })
} as any;