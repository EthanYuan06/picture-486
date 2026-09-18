import React, { useEffect, useLayoutEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T> {
    value: T;
    label: React.ReactNode;
}

interface PortalSelectProps<T> {
    value: T;
    onChange: (value: T) => void;
    options: SelectOption<T>[];
    placeholder?: string;
    icon?: React.ReactNode;
    className?: string; // Wrapper class
    triggerClassName?: string; // Button class
    triggerStyle?: React.CSSProperties; // Button style (e.g. for dynamic width)
    disabled?: boolean;
    renderOption?: (option: SelectOption<T>, isSelected: boolean, isActive: boolean) => React.ReactNode;
}

function PortalSelect<T extends string | number | null>({
    value,
    onChange,
    options,
    placeholder = '请选择',
    icon,
    className = '',
    triggerClassName = '',
    triggerStyle,
    disabled = false,
    renderOption
}: PortalSelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number; width: number; height?: number }>({ top: 0, left: 0, width: 0 });
    const [activeIndex, setActiveIndex] = useState(-1);
    
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const listboxId = useId();

    const selectedOption = options.find(o => o.value === value);

    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom - 8;
        const spaceAbove = rect.top - 8;

        const maxHeight = 300;
        let top = rect.bottom + scrollTop + 8;
        let height = Math.min(maxHeight, spaceBelow);

        if (spaceBelow < 200 && spaceAbove > spaceBelow) {
            height = Math.min(maxHeight, spaceAbove);
            top = rect.top + scrollTop - height - 8;
        }

        setPosition({
            top,
            left: rect.left + scrollLeft,
            width: rect.width,
            height
        });
    };

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
            // Add scroll/resize listeners to update position or close
            const handleScroll = () => updatePosition();
            const handleResize = () => updatePosition();
            
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);
            
            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [isOpen]);

    // Click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                triggerRef.current && 
                !triggerRef.current.contains(e.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % options.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + options.length) % options.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < options.length) {
                    onChange(options[activeIndex].value);
                    setIsOpen(false);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, options, activeIndex, onChange]);

    // Update active index when value changes or opens
    useEffect(() => {
        if (isOpen) {
            const idx = options.findIndex(o => o.value === value);
            setActiveIndex(idx >= 0 ? idx : 0);
        }
    }, [isOpen, value, options]);

    const handleToggle = () => {
        if (disabled) return;
        if (isOpen) {
            setIsOpen(false);
            return;
        }
        updatePosition();
        setIsOpen(true);
    };

    const handleSelect = (val: T) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={triggerRef}>
            <div
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-controls={listboxId}
                onClick={handleToggle}
                style={triggerStyle}
                className={`
                    flex items-center justify-between px-4 py-3 min-h-11 
                    bg-[var(--bg-card)] text-[var(--text-primary)] text-[14px] font-medium 
                    rounded-xl border border-[var(--border-color)] 
                    hover:border-primary/60 transition-all duration-200 shadow-sm cursor-pointer
                    ${isOpen ? 'border-primary/70 ring-2 ring-primary/30' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${triggerClassName}
                `}
            >
                <div className="flex items-center gap-2 truncate">
                    {icon && <span className="text-primary flex-shrink-0">{icon}</span>}
                    <span className="truncate">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown 
                    size={16} 
                    className={`text-[var(--text-secondary)] transition-transform duration-200 flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} 
                />
            </div>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    id={listboxId}
                    role="listbox"
                    style={{
                        position: 'absolute',
                        top: position.top,
                        left: position.left,
                        width: position.width,
                        maxHeight: position.height ? position.height : 300,
                        zIndex: 9999,
                    }}
                    className="
                        rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] 
                        shadow-2xl overflow-y-auto scrollbar-thin p-2
                        animate-in fade-in zoom-in-95 duration-100 origin-top
                    "
                >
                    {options.map((option, index) => {
                        const isSelected = option.value === value;
                        const isActive = index === activeIndex;
                        
                        return (
                            <div
                                key={`${option.value}-${index}`}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleSelect(option.value)}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={`
                                    w-full flex items-center justify-between px-4 py-2.5 my-0.5 rounded-xl
                                    text-[14px] font-medium cursor-pointer transition-colors
                                    ${isSelected 
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                                    }
                                    ${isActive && !isSelected ? 'bg-[var(--bg-hover)]' : ''}
                                `}
                            >
                                {renderOption ? renderOption(option, isSelected, isActive) : (
                                    <>
                                        <span className="truncate">{option.label}</span>
                                        {isSelected && <Check size={14} className="text-white flex-shrink-0 ml-2" />}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
}

export default PortalSelect;
