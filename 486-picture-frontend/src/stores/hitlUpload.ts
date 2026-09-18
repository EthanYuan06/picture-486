import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  HitlUploadConfirmation,
  HitlUploadForm,
  HitlUploadResult,
} from '../types/hitlUpload';

type HitlUploadSessionStatus = 'idle' | 'pending' | 'completed' | 'cancelled';

interface HitlUploadSessionState {
  status: HitlUploadSessionStatus;
  threadId: string | null;
  userId: string | null;
  requestSpaceId: number | null;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  imageUrl: string;
  userQuery: string;
  originalConfirmation: HitlUploadConfirmation | null;
  draftForm: HitlUploadForm | null;
  expiresAt: number | null;
  startedAt: number | null;
  result: HitlUploadResult | null;
  setPendingSession: (payload: {
    threadId: string;
    userId: string;
    requestSpaceId: number | null;
    sourceSessionId?: string | null;
    sourceMessageId?: string | null;
    imageUrl: string;
    userQuery: string;
    originalConfirmation: HitlUploadConfirmation;
    draftForm: HitlUploadForm;
    startedAt: number;
    expiresAt: number;
  }) => void;
  setDraftForm: (draftForm: HitlUploadForm) => void;
  resetDraftForm: () => void;
  setResult: (result: HitlUploadResult) => void;
  markCancelled: () => void;
  clearSession: () => void;
}

const initialState = {
  status: 'idle' as HitlUploadSessionStatus,
  threadId: null,
  userId: null,
  requestSpaceId: null,
  sourceSessionId: null,
  sourceMessageId: null,
  imageUrl: '',
  userQuery: '',
  originalConfirmation: null,
  draftForm: null,
  expiresAt: null,
  startedAt: null,
  result: null,
};

export const useHitlUploadStore = create<HitlUploadSessionState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setPendingSession: (payload) =>
        set(() => ({
          status: 'pending',
          threadId: payload.threadId,
          userId: payload.userId,
          requestSpaceId: payload.requestSpaceId,
          sourceSessionId: payload.sourceSessionId ?? null,
          sourceMessageId: payload.sourceMessageId ?? null,
          imageUrl: payload.imageUrl,
          userQuery: payload.userQuery,
          originalConfirmation: payload.originalConfirmation,
          draftForm: payload.draftForm,
          expiresAt: payload.expiresAt,
          startedAt: payload.startedAt,
          result: null,
        })),
      setDraftForm: (draftForm) =>
        set(() => ({
          draftForm,
        })),
      resetDraftForm: () =>
        set(() => ({
          draftForm: get().originalConfirmation
            ? {
                name: get().originalConfirmation?.name ?? '',
                introduction: get().originalConfirmation?.introduction ?? '',
                category: get().originalConfirmation?.category ?? '',
                tags: [...(get().originalConfirmation?.tags ?? [])],
                space_id: get().originalConfirmation?.space_id ?? null,
              }
            : null,
        })),
      setResult: (result) =>
        set(() => ({
          status: 'completed',
          result,
        })),
      markCancelled: () =>
        set(() => ({
          status: 'cancelled',
          result: null,
        })),
      clearSession: () => set(() => ({ ...initialState })),
    }),
    {
      name: 'hitl_upload_session',
      storage: createJSONStorage(() => window.localStorage),
    }
  )
);
