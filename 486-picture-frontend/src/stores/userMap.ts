import { create } from 'zustand';
import { getUserBasicInfoById, extractUserName } from '../services/user';

interface UserMapStore {
  userMap: Record<string, string>;
  pendingIds: Set<string>;
  /** 获取用户名（同步），如果不存在返回 undefined */
  getUserName: (id: string | number | undefined) => string | undefined;
  /** 触发获取用户信息的异步操作 */
  fetchUser: (id: string | number | undefined) => Promise<void>;
  /** 批量获取用户信息 */
  fetchUsers: (ids: (string | number | undefined)[]) => Promise<void>;
}

const STORAGE_KEY = 'subarupic:userNameMap:v2';

// 辅助函数：加载和保存缓存
const loadCache = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCache = (map: Record<string, string>) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
};

export const useUserMapStore = create<UserMapStore>((set, get) => ({
  userMap: loadCache(),
  pendingIds: new Set(),

  getUserName: (id) => {
    if (!id) return undefined;
    const map = get().userMap;
    return map[String(id)];
  },

  fetchUser: async (id) => {
    const sid = String(id || '').trim();
    if (!sid) return;
    
    const { userMap, pendingIds } = get();
    // 如果缓存已有或正在请求中，则跳过
    if (userMap[sid] || pendingIds.has(sid)) return;

    // 标记为正在请求
    set((state) => ({ pendingIds: new Set(state.pendingIds).add(sid) }));

    try {
      const vo = await getUserBasicInfoById(sid);
      let name = extractUserName(vo);
      
      // Fallback: use ID if name is not found but vo exists
      if (!name && vo && typeof vo === 'object') {
        const voObj = vo as Record<string, unknown>;
        if (voObj.id) {
           name = `User_${String(voObj.id).slice(-4)}`;
        }
      }

      if (name) {
        set((state) => {
          const newMap = { ...state.userMap, [sid]: name! };
          saveCache(newMap);
          return { userMap: newMap };
        });
      } else if (vo) {
         // Even if no name found, cache it as Unknown to prevent retry loop
         set((state) => {
            const newMap = { ...state.userMap, [sid]: 'Unknown' };
            saveCache(newMap);
            return { userMap: newMap };
         });
      }
    } catch (e) {
      console.error(`Failed to fetch user name for id ${sid}`, e);
    } finally {
      // 移除 pending 状态
      set((state) => {
        const next = new Set(state.pendingIds);
        next.delete(sid);
        return { pendingIds: next };
      });
    }
  },

  fetchUsers: async (ids) => {
    const uniqueIds = Array.from(
      new Set(ids.map((id) => String(id || '').trim()).filter((id) => id.length > 0))
    );
    const { userMap, fetchUser } = get();
    // 过滤掉已有缓存的 ID
    const missing = uniqueIds.filter((id) => !userMap[id]);
    
    if (missing.length === 0) return;
    
    // 并发请求（如果后端支持批量接口可在此优化）
    await Promise.all(missing.map((id) => fetchUser(id)));
  },
}));
