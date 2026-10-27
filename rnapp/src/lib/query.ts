import { QueryClient } from '@tanstack/react-query';

/** 全局 QueryClient：服务端数据缓存（T07，plan.md 技术栈） */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});
