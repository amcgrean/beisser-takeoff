import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface CardProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
}

export function SectionCard({ title, children, defaultExpanded = false }: CardProps) {
    const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

    return (
        <div className="card mb-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
            >
                <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
                <span className="text-slate-400">{isExpanded ? '−' : '+'}</span>
            </button>
            {isExpanded && <div className="p-4 pt-0 border-t border-slate-800">{children}</div>}
        </div>
    );
}

export function InputGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-4">
            <label className="input-label">{label}</label>
            {children}
        </div>
    );
}
