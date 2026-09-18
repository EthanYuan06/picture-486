import { describe, expect, it } from 'vitest';
import {
  areHitlFormsEqual,
  getRemainingSeconds,
  normalizeHitlForm,
  normalizeTags,
  validateHitlForm,
} from './hitlUpload';

describe('hitlUpload utils', () => {
  it('normalizes tags from string and removes duplicates', () => {
    expect(normalizeTags('星空，风景, 星空, 云层')).toEqual(['星空', '风景', '云层']);
  });

  it('normalizes confirmation payload into form data', () => {
    expect(
      normalizeHitlForm({
        name: '  Subaru  ',
        introduction: ` ${'a'.repeat(78)} `,
        category: '  摄影 ',
        tags: [' 夜景 ', '夜景', '星空'],
        space_id: '12',
      })
    ).toEqual({
      name: 'Subaru',
      introduction: 'a'.repeat(78),
      category: '摄影',
      tags: ['夜景', '星空'],
      space_id: 12,
    });
  });

  it('validates business constraints', () => {
    expect(
      validateHitlForm({
        name: '',
        introduction: 'a'.repeat(80),
        category: '风景',
        tags: ['a', 'b', 'c'],
        space_id: null,
      })
    ).toBe('名称不能为空且不超过50字符');

    expect(
      validateHitlForm({
        name: '测试',
        introduction: '太短',
        category: '风景',
        tags: ['a', 'b', 'c'],
        space_id: null,
      })
    ).toBe('简介长度应在50-500字符之间');
  });

  it('compares normalized forms', () => {
    expect(
      areHitlFormsEqual(
        {
          name: 'Subaru',
          introduction: 'a'.repeat(60),
          category: '风景',
          tags: ['星空', '银河'],
          space_id: null,
        },
        {
          name: ' Subaru ',
          introduction: ` ${'a'.repeat(60)} `,
          category: '风景',
          tags: ['星空', '银河'],
          space_id: null,
        }
      )
    ).toBe(true);
  });

  it('computes remaining seconds safely', () => {
    expect(getRemainingSeconds(Date.now() + 2500, Date.now())).toBeGreaterThanOrEqual(2);
    expect(getRemainingSeconds(Date.now() - 1000, Date.now())).toBe(0);
  });
});
