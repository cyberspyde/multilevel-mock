'use client';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    className?: string;
}

const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-4',
    lg: 'h-12 w-12 border-4',
};

export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
    return (
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
            <div
                className={`animate-spin rounded-full border-gray-200 border-t-blue-600 ${sizes[size]}`}
                role="status"
                aria-label="Loading"
            />
            {text && <p className="text-sm text-gray-500 animate-pulse">{text}</p>}
        </div>
    );
}

// Full page loading overlay
export function LoadingOverlay({ text = 'Loading...' }: { text?: string }) {
    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <LoadingSpinner size="lg" text={text} />
        </div>
    );
}

// Inline loading for buttons
export function ButtonSpinner() {
    return (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    );
}

export default LoadingSpinner;
