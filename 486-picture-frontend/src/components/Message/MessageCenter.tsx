import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Loader2, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { listMessageVoByPage, getUnreadMessageCount, readMessage, readAllMessage } from '../../services/message';
import { MessageVo } from '../../types/message';
import MessageItem from './MessageItem';
import { useToastStore } from '../../stores/toastStore';

const MessageCenter: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [messages, setMessages] = useState<MessageVo[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const userInfo = useAuthStore((s) => s.userInfo);
    const addToast = useToastStore((s) => s.addToast);

    useEffect(() => {
        if (!userInfo?.id) return;
        fetchUnreadCount();
    }, [userInfo?.id]);

    const fetchUnreadCount = async () => {
        try {
            const count = await getUnreadMessageCount();
            setUnreadCount(count);
        } catch (error) {
            console.error('Failed to fetch unread count', error);
        }
    };

    const fetchMessages = async (currentPage: number, refresh = false) => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await listMessageVoByPage({
                current: currentPage,
                pageSize: 10,
                // status: 0 // Optional: filter by status if needed
            });

            if (refresh) {
                setMessages(res.records);
            } else {
                setMessages((prev) => [...prev, ...res.records]);
            }

            setHasMore(res.records.length === 10);
            setPage(currentPage);
        } catch (error) {
            console.error('Failed to fetch messages', error);
        } finally {
            setLoading(false);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch messages when opening dropdown
    useEffect(() => {
        if (isOpen) {
            fetchMessages(1, true);
            // Also refresh unread count
            fetchUnreadCount();
        }
    }, [isOpen]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !loading) {
            fetchMessages(page + 1);
        }
    };

    const handleRead = async (id: string | number) => {
        try {
            const success = await readMessage(id);
            if (success) {
                // Update local state
                setMessages((prev) =>
                    prev.map((msg) => msg.id === id ? { ...msg, status: 1 } : msg)
                );
                // Update unread count
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        } catch (error) {
            addToast('操作失败', 'error');
        }
    };

    const handleReadAll = async () => {
        try {
            const success = await readAllMessage();
            if (success) {
                setMessages((prev) => prev.map((msg) => ({ ...msg, status: 1 })));
                setUnreadCount(0);
                addToast('全部已读', 'success');
            }
        } catch (error) {
            addToast('操作失败', 'error');
        }
    };

    const hasUnreadMessages = unreadCount > 0 || messages.some((msg) => msg.status !== 1);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title="消息中心"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-[var(--bg-header)]">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--bg-sidebar)] rounded-xl shadow-2xl border border-[var(--border-color)] flex flex-col max-h-[500px] animate-in fade-in zoom-in-95 duration-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-header)]/50 backdrop-blur-sm">
                        <h3 className="font-semibold text-[var(--text-primary)]">消息中心</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReadAll}
                                disabled={!hasUnreadMessages}
                                className={`text-xs flex items-center gap-1 transition-colors ${
                                    hasUnreadMessages
                                        ? 'text-[var(--text-secondary)] hover:text-primary cursor-pointer'
                                        : 'text-[var(--text-secondary)] opacity-50 cursor-not-allowed'
                                }`}
                            >
                                <CheckCheck size={14} />
                                全部已读
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div
                        ref={listRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
                    >
                        {messages.length === 0 && !loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-tertiary)]">
                                <Bell size={48} className="opacity-20 mb-2" />
                                <p>暂无消息</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg) => (
                                    <MessageItem key={msg.id} message={msg} onRead={handleRead} />
                                ))}
                                {loading && (
                                    <div className="flex justify-center py-4">
                                        <Loader2 size={20} className="animate-spin text-primary" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageCenter;
