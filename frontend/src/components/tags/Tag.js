import React from 'react';
import { Hash, X, ChevronRight } from 'lucide-react';
import tagService from '../../services/tagService';

const Tag = ({ 
    tag, 
    onRemove,
    onClick,
    size = 'md',
    variant = 'default',
    showHierarchy = false,
    className = ''
}) => {
    const sizes = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-2 text-base'
    };

    const variants = {
        default: 'bg-gray-700 text-white hover:bg-gray-600',
        colored: 'text-white hover:opacity-80',
        outline: 'border-2 border-current text-current bg-transparent hover:bg-current hover:text-white'
    };

    const tagColor = tagService.getTagColor(tag);
    const displayName = showHierarchy ? tagService.formatTagForDisplay(tag) : tag;

    const handleClick = (e) => {
        e.stopPropagation();
        onClick && onClick(tag);
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        onRemove && onRemove(tag);
    };

    const baseClasses = `
        inline-flex items-center rounded-full transition-colors duration-200 cursor-pointer
        ${sizes[size]}
        ${variant === 'colored' ? '' : variants[variant]}
        ${className}
    `;

    const style = variant === 'colored' ? { backgroundColor: tagColor } : {};

    return (
        <span
            className={baseClasses}
            style={style}
            onClick={handleClick}
            title={`Tag: ${tag}`}
        >
            <Hash className="w-3 h-3 mr-1" />
            
            {showHierarchy && tag.includes('/') ? (
                <span className="flex items-center">
                    {tag.split('/').map((part, index, parts) => (
                        <React.Fragment key={index}>
                            {index > 0 && <ChevronRight className="w-3 h-3 mx-1 opacity-60" />}
                            <span className={index === parts.length - 1 ? 'font-medium' : 'opacity-75'}>
                                {part}
                            </span>
                        </React.Fragment>
                    ))}
                </span>
            ) : (
                <span>{displayName}</span>
            )}
            
            {onRemove && (
                <button
                    onClick={handleRemove}
                    className="ml-2 hover:bg-black hover:bg-opacity-20 rounded-full p-0.5 transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </span>
    );
};

const TagList = ({ 
    tags = [], 
    onTagClick,
    onTagRemove,
    size = 'md',
    variant = 'default',
    showHierarchy = false,
    maxVisible,
    className = ''
}) => {
    const displayTags = maxVisible ? tags.slice(0, maxVisible) : tags;
    const hiddenCount = maxVisible && tags.length > maxVisible ? tags.length - maxVisible : 0;

    if (tags.length === 0) {
        return null;
    }

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {displayTags.map((tag, index) => (
                <Tag
                    key={`${tag}-${index}`}
                    tag={tag}
                    onClick={onTagClick}
                    onRemove={onTagRemove}
                    size={size}
                    variant={variant}
                    showHierarchy={showHierarchy}
                />
            ))}
            
            {hiddenCount > 0 && (
                <span className="inline-flex items-center px-3 py-1 text-sm bg-gray-600 text-gray-300 rounded-full">
                    +{hiddenCount} mais
                </span>
            )}
        </div>
    );
};

export { Tag, TagList };
export default Tag;