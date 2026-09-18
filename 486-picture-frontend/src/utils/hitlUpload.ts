import type { HitlUploadConfirmation, HitlUploadForm } from '../types/hitlUpload';

export const HITL_CONFIRM_TIMEOUT_MS = 60_000;

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return Array.from(
      new Set(
        tags
          .map((tag) => sanitizeText(tag))
          .filter((tag) => tag.length > 0)
      )
    );
  }

  if (typeof tags === 'string') {
    return Array.from(
      new Set(
        tags
          .split(/[，,]/)
          .map((tag) => sanitizeText(tag))
          .filter((tag) => tag.length > 0)
      )
    );
  }

  return [];
}

export function normalizeSpaceId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

export function normalizeHitlForm(value?: Partial<HitlUploadConfirmation> | null): HitlUploadForm {
  return {
    name: sanitizeText(value?.name),
    introduction: sanitizeText(value?.introduction),
    category: sanitizeText(value?.category),
    tags: normalizeTags(value?.tags),
    space_id: normalizeSpaceId(value?.space_id),
  };
}

export function validateHitlForm(form: HitlUploadForm): string | null {
  if (!form.name || form.name.length > 50) {
    return '名称不能为空且不超过50字符';
  }

  if (form.introduction.length < 50 || form.introduction.length > 500) {
    return '简介长度应在50-500字符之间';
  }

  if (!form.category) {
    return '分类不能为空';
  }

  if (form.tags.length < 3 || form.tags.length > 10) {
    return '标签数量应在3-10个之间';
  }

  return null;
}

export function areHitlFormsEqual(left: HitlUploadForm, right: HitlUploadForm): boolean {
  const normalizedLeft = normalizeHitlForm(left);
  const normalizedRight = normalizeHitlForm(right);

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

export function getRemainingSeconds(expiresAt: number | null, now = Date.now()): number {
  if (!expiresAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}
