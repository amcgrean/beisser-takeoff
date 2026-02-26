import React from 'react';
import { HardwareSection as HardwareSectionType, HardwareLookup } from '../../types/estimate';
import { SectionCard, InputGroup } from '../ui/SectionCard';

interface Props {
    data: HardwareSectionType;
    lookups: HardwareLookup[];
    onChange: (data: HardwareSectionType) => void;
}

export function HardwareSectionComp({ data, lookups, onChange }: Props) {
    const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onChange({
            ...data,
            counts: {
                ...data.counts,
                [name]: parseInt(value) || 0,
            },
        });
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange({ ...data, type: e.target.value });
    };

    return (
        <SectionCard title="10. Door Hardware">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1 md:col-span-2">
                    <InputGroup label="Hardware Type">
                        <select value={data.type} onChange={handleTypeChange} className="input-field">
                            <option value="">Select a style...</option>
                            {lookups.map((l) => (
                                <option key={l.display_name} value={l.display_name}>
                                    {l.display_name}
                                </option>
                            ))}
                        </select>
                    </InputGroup>
                </div>

                {Object.keys(data.counts).map((func) => (
                    <InputGroup key={func} label={func.charAt(0).toUpperCase() + func.slice(1)}>
                        <input
                            type="number"
                            name={func}
                            value={(data.counts as any)[func]}
                            onChange={handleCountChange}
                            className="input-field"
                        />
                    </InputGroup>
                ))}
            </div>
        </SectionCard>
    );
}
