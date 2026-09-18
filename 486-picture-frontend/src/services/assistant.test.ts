import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseAssistantSseRecord,
  resumeAssistantChatStream,
  streamAssistantChatMessage,
} from './assistant';

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    }
  );
}

describe('assistant stream parser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses the new event plus data SSE block', () => {
    const record = [
      'event: message',
      'data: {"type":"message","data":{"content":"你"}}',
    ].join('\n');

    expect(parseAssistantSseRecord(record)).toEqual({
      eventType: 'message',
      rawData: '{"type":"message","data":{"content":"你"}}',
      payload: {
        type: 'message',
        data: {
          content: '你',
        },
      },
    });
  });

  it('keeps backward compatibility for legacy data-only SSE blocks', () => {
    const record = 'data: {"type":"message","data":{"content":"好"}}';

    expect(parseAssistantSseRecord(record)).toEqual({
      eventType: 'message',
      rawData: '{"type":"message","data":{"content":"好"}}',
      payload: {
        type: 'message',
        data: {
          content: '好',
        },
      },
    });
  });

  it('maps new interrupt payloads into upload_confirmation for HITL pages', async () => {
    const interruptPayload = JSON.stringify({
      type: 'interrupt',
      data: {
        name: '动漫角色',
        introduction: '这是一张动漫截图，画面主体清晰，适合作为角色图集收录。',
        category: '动漫',
        tags: ['二次元', '角色', '截图'],
        space_id: null,
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createStreamResponse([`event: interrupt\ndata: ${interruptPayload}\n\n`])
      )
    );

    const onInterrupt = vi.fn();
    const result = await streamAssistantChatMessage(
      {
        thread_id: 'thread-1',
        query: '分析图片',
        user_id: '12345',
        space_id: null,
        image_url: 'https://example.com/image.jpg',
      },
      {
        onInterrupt,
      }
    );

    expect(onInterrupt).toHaveBeenCalledTimes(1);
    expect(onInterrupt).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_confirmation: expect.objectContaining({
          name: '动漫角色',
          category: '动漫',
          tags: ['二次元', '角色', '截图'],
          space_id: null,
        }),
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        upload_confirmation: expect.objectContaining({
          name: '动漫角色',
        }),
      })
    );
  });

  it('sends Accept header and required fields for stream chat requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createStreamResponse(['data: [DONE]\n\n']));

    vi.stubGlobal('fetch', fetchMock);

    await streamAssistantChatMessage({
      thread_id: 'thread-2',
      query: '你好',
      user_id: '12345',
      space_id: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ai/api/chat/stream'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        }),
        method: 'POST',
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          thread_id: 'thread-2',
          query: '你好',
          user_id: '12345',
          space_id: null,
        }),
      })
    );
  });

  it('sends resume payload to the stream endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createStreamResponse(['data: [DONE]\n\n']));

    vi.stubGlobal('fetch', fetchMock);

    await resumeAssistantChatStream({
      thread_id: 'thread-3',
      query: '',
      user_id: '12345',
      space_id: 67890,
      user_confirmed: true,
      modified_data: {
        name: '自定义图片名称',
        introduction: '自定义简介',
        category: '二次元',
        tags: ['标签1', '标签2'],
        space_id: 99999,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ai/api/chat/stream'),
      expect.objectContaining({
        body: JSON.stringify({
          thread_id: 'thread-3',
          query: '',
          user_id: '12345',
          space_id: 67890,
          user_confirmed: true,
          modified_data: {
            name: '自定义图片名称',
            introduction: '自定义简介',
            category: '二次元',
            tags: ['标签1', '标签2'],
            space_id: 99999,
          },
        }),
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
        }),
        method: 'POST',
      })
    );
  });
});
