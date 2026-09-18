import React from 'react';
import { MessageVo } from '../../types/message';
import { Check, MailOpen } from 'lucide-react';
import { formatDate } from '../../utils/date';

interface MessageItemProps {
    message: MessageVo;
    onRead: (id: string | number) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onRead }) => {
    const isRead = message.status === 1;

    return (
        <div
            className={`
        p-4 border-b border-[var(--border-color)] last:border-b-0
        hover:bg-[var(--bg-hover)] transition-colors duration-200 group
        ${isRead ? 'opacity-60' : 'bg-[var(--bg-secondary)]/30'}
      `}
        >
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-[var(--text-primary)] truncate">
                            {message.title}
                        </h4>
                        {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] break-words leading-relaxed">
                        {message.content}
                    </p>
                    <div className="mt-2 text-xs text-[var(--text-tertiary)] flex items-center gap-2">
                        {formatDate(message.createTime)}
                    </div>
                </div>

                {!isRead && (
                    <button
                        onClick={() => onRead(message.id)}
                        title="标记为已读"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-primary transition-all duration-200"
                    >
                        <Check size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default MessageItem;
